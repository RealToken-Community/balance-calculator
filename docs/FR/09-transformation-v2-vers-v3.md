# Transformation des Pools V2 vers le Format V3

## Vue d'ensemble

Depuis la refactorisation du système de boost, **toutes les pools (V2 et V3) sont maintenant traitées de manière unifiée** en utilisant le calculateur de boost V3. Pour permettre cette unification, les pools V2 sont automatiquement transformées en format V3 "full range" avant le calcul du boost.

## Principe de la Transformation

### Pourquoi transformer les pools V2 ?

Les pools V2 (comme Uniswap V2, Sushiswap, Honeyswap) n'ont pas de concept de "range" de liquidité. Toute la liquidité est disponible sur toute la courbe de prix. Pour appliquer le même système de boost que les pools V3, il est nécessaire de :

1. **Représenter les pools V2 comme des pools V3 avec un range très large** (full range)
2. **Calculer le prix actuel** de la pool en tenant compte des proportions réelles
3. **Appliquer le même algorithme de boost** que pour les pools V3 natives

### Quand la transformation a-t-elle lieu ?

La transformation se produit **automatiquement** dans le modifier `boostBalancesDexs`, **avant** le calcul du boost. Le processus est le suivant :

```
Données brutes → Identification des pools V2 → Transformation en format V3 → Calcul du boost unifié
```

## Détails Techniques

### Identification des Pools V2

Une pool est identifiée comme V2 si elle répond aux critères suivants :

- **Absence de `positionId`** : Les pools V2 n'ont pas de `positionId` (propre aux pools V3)
- **Absence de range** : Pas de `tickLower`/`tickUpper` (en mode tick) ou `minPrice`/`maxPrice` (en mode prix)

```typescript
// Code d'identification (boostBalancesDexs.ts, lignes 67-75)
const hasPositionId = typeof firstBalance.positionId === "number";
const tickLowerRaw = v3Config.sourceValue === "tick" 
  ? firstBalance.tickLower 
  : firstBalance.minPrice;
const hasRealRange = typeof tickLowerRaw === "number";

// C'est un pool V2 si pas de positionId ET pas de range
if (!hasPositionId && !hasRealRange) {
  // Pool V2 détectée
}
```

### Transformation en Format V3 Full Range

Une fois une pool V2 identifiée, elle est transformée avec les caractéristiques suivantes :

#### 1. Range Full Range

Les pools V2 sont représentées avec un range "full range" équivalent aux pools V3 full range :

- **Tick Lower** : `-887200`
- **Tick Upper** : `887200`
- **Min Price** : `1.0001^(-887200)` ≈ `1e-7`
- **Max Price** : `1.0001^(887200)` ≈ `1e7`

Ce range très large garantit que la liquidité est toujours "active" (le prix actuel est toujours dans le range).

#### 2. Calcul du Prix Actuel

Le prix actuel (`currentPrice`) est calculé en tenant compte des proportions réelles de la pool, notamment pour les pools non 50/50 (ex: Balancer 80/20) :

```typescript
// Formule utilisée (v3RangeHelper.ts, lignes 174-190)
// currentPrice = (tokenBalance(token1) * equivalentREG(token0)) / 
//                (tokenBalance(token0) * equivalentREG(token1))

const balance0 = parseFloat(token0.tokenBalance || "0");
const balance1 = parseFloat(token1.tokenBalance || "0");
const equivalent0 = parseFloat(token0.equivalentREG || "0");
const equivalent1 = parseFloat(token1.equivalentREG || "0");

if (balance0 > 0 && equivalent1 > 0) {
  currentPrice = (balance1 * equivalent0) / (balance0 * equivalent1);
}
```

**Pourquoi utiliser `equivalentREG` ?**

L'utilisation de `equivalentREG` permet de tenir compte des pools avec des ratios non 50/50. Par exemple, une pool Balancer 80/20 aura un prix calculé qui reflète correctement la proportion réelle des tokens dans la pool.

#### 3. Calcul du CurrentTick

Le `currentTick` est calculé à partir du `currentPrice` :

```typescript
const TICK_BASE = 1.0001;
const currentTick = Math.log(currentPrice) / Math.log(TICK_BASE);
```

#### 4. Création des Entrées V3

Chaque pool V2 (avec 2 tokens) est transformée en **2 entrées V3 distinctes** :

- **Token 0** : Premier token (REG si présent, sinon trié par adresse)
  - `positionId` : ID unique (commence à 200001)
  - `tokenPosition` : `0`
  - `tickLower` / `tickUpper` : Range full range
  - `currentTick` / `currentPrice` : Calculés
  - `isActive` : `true` (toujours actif pour un full range)

- **Token 1** : Deuxième token
  - `positionId` : Même ID que token 0
  - `tokenPosition` : `1`
  - Mêmes champs de range et prix que token 0

### Exemple de Transformation

**Avant (Pool V2)** :
```json
[
  {
    "poolAddress": "0x123...",
    "tokenAddress": "0xREG...",
    "tokenSymbol": "REG",
    "tokenBalance": "1000",
    "equivalentREG": "1000"
  },
  {
    "poolAddress": "0x123...",
    "tokenAddress": "0xUSDC...",
    "tokenSymbol": "USDC",
    "tokenBalance": "2000",
    "equivalentREG": "1000"
  }
]
```

**Après (Format V3)** :
```json
[
  {
    "poolAddress": "0x123...",
    "tokenAddress": "0xREG...",
    "tokenSymbol": "REG",
    "tokenBalance": "1000",
    "equivalentREG": "1000",
    "positionId": 200001,
    "tokenPosition": 0,
    "isActive": true,
    "tickLower": -887200,
    "tickUpper": 887200,
    "currentTick": 0,
    "currentPrice": "2.0",
    "minPrice": 1e-7,
    "maxPrice": 1e7
  },
  {
    "poolAddress": "0x123...",
    "tokenAddress": "0xUSDC...",
    "tokenSymbol": "USDC",
    "tokenBalance": "2000",
    "equivalentREG": "1000",
    "positionId": 200001,
    "tokenPosition": 1,
    "isActive": true,
    "tickLower": -887200,
    "tickUpper": 887200,
    "currentTick": 0,
    "currentPrice": "2.0",
    "minPrice": 1e-7,
    "maxPrice": 1e7
  }
]
```

## Calcul du Boost Unifié

Après la transformation, **toutes les pools (V2 transformées et V3 natives) utilisent le même calculateur de boost** : `applyV3Boost()`.

### Avantages de cette Approche

1. **Cohérence** : Toutes les pools sont traitées de la même manière
2. **Simplicité** : Un seul algorithme de boost à maintenir
3. **Flexibilité** : Les pools V2 bénéficient des mêmes fonctionnalités que les pools V3 (modes proximity, centered, etc.)

### Comportement du Boost pour les Pools V2 Transformées

Les pools V2 transformées en full range ont les caractéristiques suivantes :

- **Range très large** : Le range full range est si large que le boost sera généralement proche du `minBoost`
- **Toujours actif** : `isActive = true` car le prix actuel est toujours dans le range
- **Boost basé sur la proximité** : En mode "proximity", le boost décroît depuis le prix actuel selon les paramètres `decaySlicesDown` et `decaySlicesUp`

## Limitations

### Pools Multi-Tokens

Les pools avec **plus de 2 tokens** (ex: certaines pools Balancer) ne sont **pas transformées**. Elles sont ignorées lors de la transformation :

```typescript
// Transformer seulement les pools avec exactement 2 tokens
if (uniqueTokensArray.length === 2) {
  // Transformation...
} else {
  logInTerminal("debug", [
    `Skipping V2 pool ${poolKey}: expected 2 tokens, got ${uniqueTokensArray.length}`
  ]);
}
```

Ces pools conservent leur format original et ne bénéficient pas du système de boost V3.

### Gestion des Erreurs

Si le calcul du `currentPrice` échoue (valeur invalide ou infinie), une erreur est levée :

```typescript
if (currentPrice <= 0 || !isFinite(currentPrice)) {
  throw new Error(
    `Cannot calculate valid currentPrice for pool ${poolAddress}...`
  );
}
```

Cette erreur empêche la transformation et garantit la cohérence des données.

## Fichiers Concernés

### Code Principal

- **`src/modifiers/boostBalancesDexs.ts`** : 
  - Identification des pools V2 (lignes 53-99)
  - Transformation avant le calcul du boost (lignes 101-126)
  - Application du boost unifié (lignes 128-209)

- **`src/utils/v3RangeHelper.ts`** :
  - `transformV2PoolToV3FullRange()` : Fonction principale de transformation (lignes 128-257)
  - `generateV3RangeForV3Pool()` : Génération du range full range (lignes 6-19)
  - `transformAllV2PoolsToV3()` : Transformation globale (pour export JSON, lignes 35-120)

- **`src/utils/v3BoostCalculator.ts`** :
  - `applyV3Boost()` : Calculateur de boost unifié utilisé pour toutes les pools (lignes 550-587)

### Configuration

- **`src/configs/optionsModifiers.ts`** :
  - Configuration V3 globale (`defaultV3`) utilisée pour toutes les pools
  - Paramètres de boost (maxBoost, minBoost, decaySlices, etc.)

## Logs et Debug

Le processus de transformation génère des logs pour faciliter le débogage :

```
[V2→V3] Replacing 2 V2 entries with 4 V3 entries for sushiswap
[V2→V3] Final balances count for sushiswap: 10 (was 8)
```

Les logs de debug incluent :
- Détection des pools V2
- Transformation de chaque pool
- Nombre d'entrées remplacées
- Compteurs finaux

## Conclusion

La transformation automatique des pools V2 en format V3 permet une **unification complète du système de boost**. Toutes les pools sont maintenant traitées de manière cohérente, tout en préservant les caractéristiques spécifiques de chaque type de pool. Cette approche simplifie la maintenance du code et garantit un comportement uniforme pour le calcul du pouvoir de vote.

