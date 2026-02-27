import { BigNumber } from "bignumber.js";
import { DexValue, Network } from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import { SourceBalancesREG } from "../types/REG.types.js";
import { DexBoostConfig, NormalizeOptions } from "../types/inputModles.types.js";
import { logInTerminal } from "../utils/lib.js";
import { applyV3Boost } from "../utils/v3BoostCalculator.js";
import { generateV3RangeForV2Pool, transformV2PoolToV3FullRange } from "../utils/v3RangeHelper.js";
import { V3BoostParams } from "../utils/v3BoostCalculator.js";

/**
 * Modifie les balances des DEX en fonction des options spécifiées
 * @param data Données d'entrée de type SourceBalancesREG[]
 * @param options Options de boost des balances des DEX
 * @returns Données modifiées de type SourceBalancesREG[]
 */
export function boostBalancesDexs(
  data: SourceBalancesREG[],
  options: NormalizeOptions["boostBalancesDexs"]
): SourceBalancesREG[] {
  console.info(i18n.t("modifiers.infoApplyModifier", { modifier: "boosBalancesDexs" }), options);

  // Si aucune option de boost n'est fournie, retourner les données inchangées
  if (!options || Object.keys(options).length === 0) {
    console.warn(i18n.t("modifiers.warnNoOptions", { modifier: "boosBalancesDexs" }));
    return data;
  }

  // Compteur global pour les positionId
  let globalPositionIdCounter = 200001; // pour ne pas confondre avec les positionId des pools V3 pour le moment

  // Parcourir chaque utilisateur
  return data.map((user) => {
    // Parcourir chaque réseau dans les balances de l'utilisateur
    for (const network in user.sourceBalance) {
      const dexs = user.sourceBalance[network as Network]?.dexs;
      if (!dexs || Object.keys(dexs).length === 0) continue;

      // Parcourir chaque DEX dans le réseau
      for (const dex in dexs) {
        const dexOptions = options[dex as DexValue];
        if (!dexs[dex as DexValue]?.length || !dexOptions) continue;

        const dexBalances = dexs[dex as DexValue]!;

        // Récupérer la config V3 (depuis defaultV3 ou override DEX)
        const v3Config = getV3Config(dex as DexValue, options);
        if (!v3Config) {
          console.warn(`No V3 config found for ${dex}, skipping boost`);
          continue;
        }

        // Transformer les pools V2 en format V3 full range AVANT le calcul
        // Grouper les balances par poolAddress pour identifier les pools V2
        const balancesByPool = new Map<string, typeof dexBalances>();
        const v2PoolsToTransform = new Map<string, typeof dexBalances>();
        const v2BalancesToRemove = new Set<any>();

        dexBalances.forEach((balance) => {
          const poolKey = balance.poolAddress || "unknown";
          if (!balancesByPool.has(poolKey)) {
            balancesByPool.set(poolKey, []);
          }
          balancesByPool.get(poolKey)!.push(balance);
        });

        // Identifier les pools V2 (pas de positionId, pas de tickLower)
        balancesByPool.forEach((poolBalances, poolKey) => {
          const firstBalance = poolBalances[0];
          const hasPositionId = typeof firstBalance.positionId === "number";
          const tickLowerRaw = v3Config.sourceValue === "tick" ? firstBalance.tickLower : firstBalance.minPrice;
          const hasRealRange = typeof tickLowerRaw === "number";

          // C'est un pool V2 si pas de positionId ET pas de range
          if (!hasPositionId && !hasRealRange) {
            logInTerminal("debug", [`Detected V2 pool: ${poolKey} with ${poolBalances.length} tokens`]);
            // Dédupliquer par tokenAddress
            const uniqueTokens = new Map<string, any>();
            poolBalances.forEach((balance) => {
              const addr = balance.tokenAddress?.toLowerCase();
              if (addr) {
                uniqueTokens.set(addr, balance);
              }
            });

            const uniqueTokensArray = Array.from(uniqueTokens.values());

            // Transformer seulement les pools avec exactement 2 tokens
            if (uniqueTokensArray.length === 2) {
              logInTerminal("debug", [`Will transform V2 pool: ${poolKey} with tokens: ${uniqueTokensArray.map(t => t.tokenSymbol).join(', ')}`]);
              v2PoolsToTransform.set(poolKey, uniqueTokensArray);
              poolBalances.forEach((balance) => {
                v2BalancesToRemove.add(balance);
              });
            } else {
              logInTerminal("debug", [`Skipping V2 pool ${poolKey}: expected 2 tokens, got ${uniqueTokensArray.length}`]);
            }
          }
        });

        // Transformer les pools V2 et remplacer les entrées
        const v3Replacements: any[] = [];

        v2PoolsToTransform.forEach((poolBalances, poolKey) => {
          try {
            logInTerminal("debug", [`Transforming V2 pool ${poolKey} with positionId ${globalPositionIdCounter}`]);
            const transformed = transformV2PoolToV3FullRange(poolBalances, globalPositionIdCounter);
            logInTerminal("debug", [`Transformed pool ${poolKey}: ${transformed.length} entries created`]);
            v3Replacements.push(...transformed);
            globalPositionIdCounter++;
          } catch (error) {
            console.warn(`Failed to transform V2 pool ${poolKey}:`, error);
          }
        });

        // Supprimer les entrées V2 et ajouter les entrées V3
        let finalDexBalances = dexBalances;
        if (v2BalancesToRemove.size > 0 || v3Replacements.length > 0) {
          console.info(`[V2→V3] Replacing ${v2BalancesToRemove.size} V2 entries with ${v3Replacements.length} V3 entries for ${dex}`);
          logInTerminal("debug", [`Replacing ${v2BalancesToRemove.size} V2 entries with ${v3Replacements.length} V3 entries for ${dex}`]);
          finalDexBalances = dexBalances.filter((balance) => !v2BalancesToRemove.has(balance));
          finalDexBalances.push(...v3Replacements);
          dexs[dex as DexValue] = finalDexBalances as any;
          console.info(`[V2→V3] Final balances count for ${dex}: ${finalDexBalances.length} (was ${dexBalances.length})`);
          logInTerminal("debug", [`Final balances count for ${dex}: ${finalDexBalances.length}`]);
        }

        // Appliquer le boost à chaque balance du DEX
        finalDexBalances.forEach((balance) => {
          // Garder une référence à la balance équivalente REG originale pour mettre à jour les totaux
          const oldEquivalentREG = balance.equivalentREG;
          let newEquivalentREG = balance.equivalentREG;

          // Récupérer les multiplicateurs de base
          const defaultConfig = getDefaultConfig(dexOptions, options);
          const baseBoost = defaultConfig[balance.tokenSymbol] || defaultConfig["*"] || 1;
          const baseBoostREG = defaultConfig["REG"] || 4; // REG a toujours un boost de base de 4
          const baseBoostFactor = baseBoost / baseBoostREG;

          // Déterminer si c'est une vraie position V3 (a des ranges) ou V2 (pas de ranges)
          // Vérifier que les valeurs sont des nombres, pas false/undefined
          const tickLowerRaw = v3Config.sourceValue === "tick" ? balance.tickLower : balance.minPrice;
          const tickUpperRaw = v3Config.sourceValue === "tick" ? balance.tickUpper : balance.maxPrice;
          const hasRealRange = typeof tickLowerRaw === "number" && typeof tickUpperRaw === "number";

          let valueLower: number | null;
          let valueUpper: number | null;
          let currentValue: number;
          let isActive: boolean;

          if (hasRealRange) {
            // V3 réel : utiliser le range réel (ou V2 transformé)
            valueLower = tickLowerRaw as number;
            valueUpper = tickUpperRaw as number;
            currentValue =
              v3Config.sourceValue === "tick"
                ? (typeof balance.currentTick === "number" ? balance.currentTick : 0)
                : parseFloat(balance.currentPrice ?? "0");
            isActive = balance.isActive ?? true;
          } else {
            // Fallback : générer range artificiel (ne devrait plus arriver après transformation)
            const artificialRange = generateV3RangeForV2Pool();
            valueLower = artificialRange.valueLower;
            valueUpper = artificialRange.valueUpper;
            currentValue = parseFloat(balance.currentPrice ?? "0") || 1; // Prix par défaut si non disponible
            isActive = true; // Range très large = toujours actif
          }

          // Gestion de la liquidité unilatérale pour le mode proximity
          // S'assurer que les valeurs sont bien des nombres ou null (jamais false)
          let effectiveValueLower: number | null = typeof valueLower === "number" ? valueLower : null;
          let effectiveValueUpper: number | null = typeof valueUpper === "number" ? valueUpper : null;

          if (v3Config.boostMode === "proximity" && isActive && balance.tokenPosition !== undefined) {
            if (balance.tokenPosition === 0) {
              effectiveValueLower = null; // Token0: liquidité de currentValue à valueUpper
            } else if (balance.tokenPosition === 1) {
              effectiveValueUpper = null; // Token1: liquidité de valueLower à currentValue
            }
          }

          // TOUJOURS utiliser applyV3Boost() pour toutes les pools
          // S'assurer que les valeurs sont bien des nombres ou null (jamais false/undefined)
          const finalValueLower: number | null = typeof effectiveValueLower === "number" ? effectiveValueLower : null;
          const finalValueUpper: number | null = typeof effectiveValueUpper === "number" ? effectiveValueUpper : null;
          
          newEquivalentREG = applyV3Boost(
            baseBoostFactor,
            balance.equivalentREG,
            isActive,
            finalValueLower,
            finalValueUpper,
            currentValue,
            v3Config
          );

          // Mettre à jour la balance avec la nouvelle valeur
          logInTerminal("debug", [
            "DEBUG FINALISED boost",
            balance.positionId,
            balance.tokenSymbol,
            "newEquivalentREG",
            newEquivalentREG,
          ]);
          balance.equivalentREG = newEquivalentREG;

          // Mettre à jour les totaux
          updateTotals(user, network as Network, oldEquivalentREG, newEquivalentREG, balance.tokenSymbol === "REG");
        });
      }
    }

    return user;
  });
}

/**
 * Récupère la configuration V3 pour un DEX (depuis defaultV3 ou override DEX)
 * @param dex Nom du DEX
 * @param options Options de normalisation
 * @returns Configuration V3 ou null
 */
function getV3Config(dex: DexValue, options: NormalizeOptions["boostBalancesDexs"]): V3BoostParams | null {
  if (!options) return null;

  // Vérifier si le DEX a une config spécifique avec v3
  const dexConfig = options[dex];
  if (dexConfig && !Array.isArray(dexConfig) && dexConfig.v3) {
    return dexConfig.v3;
  }

  // Sinon, utiliser defaultV3 si disponible
  const defaultV3 = (options as any).defaultV3;
  if (defaultV3) {
    return defaultV3;
  }

  return null;
}

/**
 * Récupère la configuration default (multiplicateurs de base)
 * @param dexOptions Options du DEX
 * @param options Options globales
 * @returns Configuration default
 */
function getDefaultConfig(
  dexOptions: DexBoostConfig | [string[], number[]] | undefined,
  options: NormalizeOptions["boostBalancesDexs"]
): { [tokenSymbol: string]: number } {
  // Si format array (ancien format), convertir
  if (Array.isArray(dexOptions)) {
    const [tokensToApply, boostFactors] = dexOptions;
    const result: { [tokenSymbol: string]: number } = {};
    tokensToApply.forEach((token, index) => {
      result[token] = boostFactors[index] ?? 1;
    });
    return result;
  }

  // Si format objet avec default
  if (dexOptions && !Array.isArray(dexOptions) && dexOptions.default) {
    return dexOptions.default;
  }

  // Sinon, utiliser default global si disponible
  const globalDefault = (options as any)?.default;
  if (globalDefault) {
    return globalDefault;
  }

  // Par défaut
  return { "*": 1 };
}

/**
 * Met à jour les totaux des balances après application d'un boost
 * @param user Utilisateur dont les balances sont modifiées
 * @param network Réseau concerné
 * @param oldValue Ancienne valeur équivalente REG
 * @param newValue Nouvelle valeur équivalente REG
 * @param isRegToken Si le token concerné est REG
 */
function updateTotals(
  user: SourceBalancesREG,
  network: Network,
  oldValue: string,
  newValue: string,
  isRegToken: boolean
) {
  const networkMaj = network.charAt(0).toUpperCase() + network.slice(1);
  const totalBalanceKey = isRegToken ? "totalBalanceREG" : "totalBalanceEquivalentREG";
  const totalBalanceKeyNetwork = isRegToken ? `totalBalanceReg${networkMaj}` : `totalBalanceEquivalentReg${networkMaj}`;

  // Mettre à jour le total du réseau
  user[totalBalanceKeyNetwork] = new BigNumber(user[totalBalanceKeyNetwork])
    .minus(oldValue)
    .plus(newValue)
    .toString(10);

  // Mettre à jour le total global par type
  user[totalBalanceKey] = new BigNumber(user[totalBalanceKey]).minus(oldValue).plus(newValue).toString(10);

  // Mettre à jour le total général
  user.totalBalance = new BigNumber(user.totalBalance).minus(oldValue).plus(newValue).toString(10);
}
