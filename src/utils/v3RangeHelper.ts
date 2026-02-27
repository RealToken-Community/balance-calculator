/**
 * Génère un range artificiel V3 pour les pools V2 (full range)
 * @param currentPrice Prix actuel (optionnel, pour centrer le range)
 * @returns Range artificiel très large pour simuler un pool V2
 */
export function generateV3RangeForV2Pool(currentPrice?: number): {
  valueLower: number;
  valueUpper: number;
} {
  // Range très large pour simuler un pool V2 "full range"
  // Ces valeurs garantissent que le boost sera minimal (équivalent V2)
  const valueLower = 1e-7; // 0.0000001
  const valueUpper = 1e7; // 10000000

  return {
    valueLower,
    valueUpper,
  };
}

/**
 * Constantes pour les pools V2 full range (identique aux pools V3 full range)
 */
const TICK_BASE = 1.0001;
const V2_FULL_RANGE_TICK_LOWER = -887200;
const V2_FULL_RANGE_TICK_UPPER = 887200;
const REG_ADDRESS = "0x0aa1e96d2a46ec6beb2923de1e61addf5f5f1dce".toLowerCase();

/**
 * Transforme toutes les pools V2 en format V3 full range dans les données complètes
 * Cette fonction doit être appelée avant de sauvegarder le fichier JSON
 * @param balances Tableau de toutes les balances
 * @returns Tableau de balances avec les pools V2 transformées
 */
export function transformAllV2PoolsToV3(balances: any[]): any[] {
  let globalPositionIdCounter = 200001; // Commencer à 200001 (??)

  return balances.map((wallet) => {
    const sourceBalance = wallet.sourceBalance || {};
    
    // Parcourir tous les réseaux
    for (const network in sourceBalance) {
      const networkData = sourceBalance[network];
      if (!networkData || !networkData.dexs) continue;

      // Parcourir tous les DEX
      for (const dexName in networkData.dexs) {
        const dexBalances = networkData.dexs[dexName];
        if (!Array.isArray(dexBalances) || dexBalances.length === 0) continue;

        // Grouper les balances par poolAddress
        const balancesByPool = new Map<string, any[]>();
        dexBalances.forEach((balance) => {
          const poolKey = balance.poolAddress || "unknown";
          if (!balancesByPool.has(poolKey)) {
            balancesByPool.set(poolKey, []);
          }
          balancesByPool.get(poolKey)!.push(balance);
        });

        // Identifier et transformer les pools V2
        const v2PoolsToTransform = new Map<string, any[]>();
        const v2BalancesToRemove = new Set<any>();

        balancesByPool.forEach((poolBalances, poolKey) => {
          const firstBalance = poolBalances[0];
          const hasPositionId = typeof firstBalance.positionId === "number";
          const hasTickLower = typeof firstBalance.tickLower === "number";
          const hasMinPrice = typeof firstBalance.minPrice === "number";

          // C'est un pool V2 si pas de positionId ET pas de range
          if (!hasPositionId && !hasTickLower && !hasMinPrice) {
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
            // Les pools avec plus de 2 tokens (ex: Balancer multi-tokens) ne sont pas supportées.
            if (uniqueTokensArray.length === 2) {
              v2PoolsToTransform.set(poolKey, uniqueTokensArray);
              poolBalances.forEach((balance) => {
                v2BalancesToRemove.add(balance);
              });
            }
          }
        });

        // Transformer les pools V2
        const v3Replacements: any[] = [];
        v2PoolsToTransform.forEach((poolBalances) => {
          try {
            const transformed = transformV2PoolToV3FullRange(poolBalances, globalPositionIdCounter);
            v3Replacements.push(...transformed);
            globalPositionIdCounter++;
          } catch (error) {
            console.error(`Failed to transform V2 pool:`, error);
            // Propager l'erreur car un currentPrice invalide ne devrait pas arriver
            throw error;
          }
        });

        // Remplacer les entrées V2 par les entrées V3
        if (v2BalancesToRemove.size > 0 || v3Replacements.length > 0) {
          const newDexBalances = dexBalances.filter((balance) => !v2BalancesToRemove.has(balance));
          newDexBalances.push(...v3Replacements);
          networkData.dexs[dexName] = newDexBalances;
        }
      }
    }

    return wallet;
  });
}

/**
 * Transforme un pool V2 en format V3 full range
 * @param poolBalances Les deux tokens du pool (doit contenir exactement 2 tokens)
 * @param positionId ID unique pour cette position
 * @returns Les deux balances transformées avec les champs V3
 */
export function transformV2PoolToV3FullRange(
  poolBalances: any[],
  positionId: number
): any[] {
  if (poolBalances.length !== 2) {
    throw new Error(`Expected exactly 2 tokens in pool, got ${poolBalances.length}`);
  }

  // Dédupliquer par tokenAddress (au cas où)
  const uniqueTokens = new Map<string, any>();
  poolBalances.forEach((token) => {
    const addr = token.tokenAddress?.toLowerCase();
    if (addr) {
      uniqueTokens.set(addr, token);
    }
  });

  const tokens = Array.from(uniqueTokens.values());
  if (tokens.length !== 2) {
    throw new Error(`Expected exactly 2 unique tokens in pool, got ${tokens.length}`);
  }

  // Avoir le REG en premier
  const addr0 = tokens[0].tokenAddress?.toLowerCase() || "";
  const addr1 = tokens[1].tokenAddress?.toLowerCase() || "";

  let token0: any;
  let token1: any;

  if (addr0 === REG_ADDRESS) {
    token0 = tokens[0];
    token1 = tokens[1];
  } else if (addr1 === REG_ADDRESS) {
    token0 = tokens[1];
    token1 = tokens[0];
  } else {
    // Si pas de REG dans le pool, trier par ordre alphabétique
    if (addr0 < addr1) {
      token0 = tokens[0];
      token1 = tokens[1];
    } else {
      token0 = tokens[1];
      token1 = tokens[0];
    }
  }

  // Calculer currentPrice en tenant compte des proportions réelles de la pool
  // Pour les pools non 50/50 (ex: Balancer 80/20), il faut utiliser equivalentREG
  // Formule: currentPrice = (tokenBalance(token1) * equivalentREG(token0)) / (tokenBalance(token0) * equivalentREG(token1))
  // Les tokenBalance sont déjà en unités réelles (pas besoin d'ajuster les decimals)
  const balance0 = parseFloat(token0.tokenBalance || "0");
  const balance1 = parseFloat(token1.tokenBalance || "0");
  const equivalent0 = parseFloat(token0.equivalentREG || "0");
  const equivalent1 = parseFloat(token1.equivalentREG || "0");

  let currentPrice = 1;
  // Utiliser la formule avec equivalentREG si disponible et valide
  if (balance0 > 0 && equivalent1 > 0) {
    currentPrice = (balance1 * equivalent0) / (balance0 * equivalent1);
  } else if (balance0 > 0) {
    // Fallback sur l'ancienne formule si equivalentREG n'est pas disponible
    currentPrice = balance1 / balance0;
  }

  // Calculer currentTick = ln(current_price) / ln(1.0001)
  if (currentPrice <= 0 || !isFinite(currentPrice)) {
    const poolAddress = token0.poolAddress || "unknown";
    const token0Symbol = token0.tokenSymbol || "unknown";
    const token1Symbol = token1.tokenSymbol || "unknown";
    const errorDetails = {
      poolAddress,
      token0Symbol,
      token1Symbol,
      balance0,
      balance1,
      equivalent0,
      equivalent1,
      calculatedPrice: currentPrice,
    };
    console.error(
      `Invalid currentPrice calculated for V2 pool transformation:`,
      errorDetails
    );
    throw new Error(
      `Cannot calculate valid currentPrice for pool ${poolAddress} (${token0Symbol}/${token1Symbol}). ` +
        `Balance0: ${balance0}, Balance1: ${balance1}, ` +
        `Equivalent0: ${equivalent0}, Equivalent1: ${equivalent1}, ` +
        `Result: ${currentPrice}`
    );
  }
  const currentTick = Math.log(currentPrice) / Math.log(TICK_BASE);

  // Calculer minPrice et maxPrice à partir des ticks
  const minPrice = Math.pow(TICK_BASE, V2_FULL_RANGE_TICK_LOWER);
  const maxPrice = Math.pow(TICK_BASE, V2_FULL_RANGE_TICK_UPPER);

  // Créer les deux entrées V3
  // S'assurer que tokenDecimals est un nombre (peut être une string dans les données)
  const decimals0 = typeof token0.tokenDecimals === "string" ? parseInt(token0.tokenDecimals) : (token0.tokenDecimals || 18);
  const decimals1 = typeof token1.tokenDecimals === "string" ? parseInt(token1.tokenDecimals) : (token1.tokenDecimals || 18);

  return [
    {
      ...token0,
      tokenDecimals: decimals0, // S'assurer que c'est un nombre
      positionId,
      tokenPosition: 0,
      isActive: true,
      tickLower: V2_FULL_RANGE_TICK_LOWER,
      tickUpper: V2_FULL_RANGE_TICK_UPPER,
      currentTick,
      currentPrice: currentPrice.toString(),
      minPrice,
      maxPrice,
    },
    {
      ...token1,
      tokenDecimals: decimals1, // S'assurer que c'est un nombre
      positionId,
      tokenPosition: 1,
      isActive: true,
      tickLower: V2_FULL_RANGE_TICK_LOWER,
      tickUpper: V2_FULL_RANGE_TICK_UPPER,
      currentTick,
      currentPrice: currentPrice.toString(),
      minPrice,
      maxPrice,
    },
  ];
}

