# Mode "priceRangeMode: linear"

Lorsque le paramètre `priceRangeMode` est défini sur `"linear"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système de calcul peut entrer dans 2 logiques de calcul en fonction du paramètre `boostMode`  :

- `boostMode: centered` : le boost est calculé en fonction du centrage de la plage par rapport au prix actuel
- `boostMode: proximity` : le boost est calculé en fonction de la position relative du prix actuel par rapport aux différentes tranches de liquidités dans la plage

Les valeurs source utilisées pour le calcul peuvent être soit `tick` soit `priceDecimals` à définir dans le paramètre `sourceValue` de l'objet `v3`.

## Fonctionnement "boostMode: centered"

Dans ce mode, le calcul applique le boost maximum (paramètre `maxBoost`) en fonction du centrage de la plage par rapport au prix actuel.
Plus le prix est proche d'un côté ou de l'autre de la plage, plus le boost est faible (il n'y a pas de base de limitation sur la largeur de la plage).
Le paramètre `rangeWidthFactor` permet de limiter la largeur maximum ou demander une largeur minimum de la plage (Voir les infos spécifiques sur ce paramètre dans l'annexe).

Les positions inactives auront un facteur de boost soit de 1 par défaut soit la valeur définie par le paramètre `inactiveBoost`.

Le paramètre `sourceValue` permet de définir la valeur source utilisée pour le calcul, il peut être soit `tick` soit `priceDecimals` à définir dans l'objet `v3` (plus d'information sur ce paramètre dans la section dédiée dans l'annexe).

### Exemples de calcul

En utilisant les données des scénarios disponibles dans `balancesREG_mock_examples.json` et avec les paramètres suivants définis dans `src/configs/optionsModifiers.ts`:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2 // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "linear",
        boostMode: "centered",
        inactiveBoost: 0,
        maxBoost: 5,
        minBoost: 1,
    }
  }
}
```

### Exemples détaillés de calcul de boost pour positions Uniswap V3 🔍

La configuration utilisée pour ces calculs est définie dans `optionsModifiers.ts` :

- `sourceValue: "priceDecimals"` (utilise les prix plutôt que les ticks)
- `priceRangeMode: "linear"` (variation linéaire du boost)
- `boostMode: "centered"` (favorise les positions centrées)
- `inactiveBoost: 0` (pas de boost pour les positions inactives)
- `maxBoost: 5` (boost maximal au centre de la plage)
- `minBoost: 1` (boost minimal aux extrémités de la plage)
- `rangeWidthFactor: non spécifié dans cette configuration d'exemple (par défaut, son influence est neutre, résultant en un facteur de boost de largeur de 1).`

### Scénario 1 : 50% USDC / 50% REG, range 0.5$ à 1.5$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.0$
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 500 tokens
- Balance USDC équivalent REG: 500 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.0 - 0.5) / 1.0 = 0.5
3. **Centrage (centeredness)** = 1 - |0.5 - 0.5| × 2 = 1.0 (position parfaitement centrée)
4. **Facteur de largeur (rangeWidthFactorBoost)** = 1.0 (le paramètre `rangeWidthFactor` n'étant pas spécifié dans la configuration de cet exemple, son impact est neutre ici, résultant en un facteur de 1)
5. **Boost linéaire** = 1 + 1.0 × (5 - 1) = 5.0
6. **Boost final** = 5.0 × 1.0 = 5.0

#### Pouvoir de vote :

- REG: 500 × 5.0 (boost) × (4/4) = 2500
- USDC: 500 × 5.0 (boost) × (2/4) = 1250
- **Total : 3750**

### Scénario 2 : 75% REG / 25% USDC, range 0.5$ à 1.5$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 0.63$ (plus proche de la borne inférieure)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 655.22 tokens
- Balance USDC: 217.18 tokens (équivalent à 344.78 REG au prix de 0.63$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (0.63 - 0.5) / 1.0 = 0.13
3. **Centrage (centeredness)** = 1 - |0.13 - 0.5| × 2 = 1 - 0.74 = 0.26 (plus proche de l'extrémité)
4. **Boost linéaire** = 1 + 0.26 × (5 - 1) = 1 + 0.26 × 4 = 1 + 1.04 = 2.04
5. **Boost final** = 2.04 × 1.0 (facteur de largeur implicite) = 2.04

#### Pouvoir de vote :

- REG: 655.22 × 2.04 (boost) × (4/4) = 1336.65
- USDC: 344.78 × 2.04 (boost) × (2/4) = 351.68
- **Total : 1688.33**

### Scénario 3 : 25% REG / 75% USDC, range 0.5$ à 1.5$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 1.22$ (plus proche de la moyenne)
- Prix min: 0.5$
- Prix max: 1.5$
- Balance REG: 289.32 tokens
- Balance USDC: 867.44 tokens (équivalent à 710.68 REG au prix de 1.22$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 1.5 - 0.5 = 1.0
2. **Position relative du prix** = (1.22 - 0.5) / 1.0 = 0.72
3. **Centrage (centeredness)** = 1 - |0.72 - 0.5| × 2 = 1 - 0.44 = 0.56 (moyennement centré)
4. **Boost linéaire** = 1 + 0.56 × (5 - 1) = 1 + 0.56 × 4 = 1 + 2.24 = 3.24
5. **Boost final** = 3.24 × 1.0 (facteur de largeur implicite) = 3.24

#### Pouvoir de vote :

- REG: 289.32 × 3.24 (boost) × (4/4) = 937.40
- USDC: 710.68 × 3.24 (boost) × (2/4) = 1151.85
- **Total : 2089.25**

### Scénario 4 : 100% USDC, range 0.5$ à 0.99$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.5$
- Prix max: 0.99$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

#### Pouvoir de vote :

- USDC: 1000 × 0 (boost) × factorREGtoOtherToken (2/4) = 0
- **Total : 0**

### Scénario 5 : 100% REG, range 1.01$ à 1.5$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 1.01$
- Prix max: 1.5$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

#### Pouvoir de vote :

- REG: 1000 × 0 (boost) × factorREGtoOtherToken (4/4) = 0
- **Total : 0**

### Scénario 6 : 100% USDC, range 0.01$ à 0.1$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.01$
- Prix max: 0.1$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

#### Pouvoir de vote :

- USDC: 1000 × 0 (boost) × factorREGtoOtherToken (2/4) = 0
- **Total : 0**

### Scénario 7 : 100% REG, range 100$ à 110$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 100$
- Prix max: 110$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 0

#### Pouvoir de vote :

- REG: 1000 × 0 (boost) × factorREGtoOtherToken (4/4) = 0
- **Total : 0**

### Scénario 8 : 2.4% REG / 97.6% USDC, range 1.05$ à 2.75$

#### Données d'entrée :

- Position active (isActive: true)
- Prix actuel: 2.7$ (très proche de la borne supérieure)
- Prix min: 1.05$
- Prix max: 2.75$
- Balance REG: 8.772 tokens
- Balance USDC: 976.28 tokens (équivalent à 361.585 REG au prix de 2.7$)
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

1. **Largeur de la plage (valueWidth)** = 2.75 - 1.05 = 1.7
2. **Position relative du prix** = (2.7 - 1.05) / 1.7 = 0.97 (très proche de la borne supérieure)
3. **Centrage (centeredness)** = 1 - |0.97 - 0.5| × 2 = 1 - 0.94 = 0.06 (très décentré)
4. **Boost linéaire** = 1 + 0.06 × (5 - 1) = 1 + 0.06 × 4 = 1 + 0.24 = 1.24
5. **Boost final** = 1.24 × 1.0 (facteur de largeur implicite) = 1.24

#### Pouvoir de vote :

- REG: 8.772 × 1.24 (boost) × (4/4) = 10.88
- USDC: 361.585 × 1.24 (boost) × (2/4) = 224.18
- **Total : 235.06**

### Résumé des résultats

| Scénario | Description                          | État    | Prix  | Centrage | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------------ | ------- | ----- | -------- | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif   | 1.00$ | 1.00     | 5.00      | 2.50       | 3750            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif   | 0.63$ | 0.26     | 2.04      | 1.02       | 1688            |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif   | 1.22$ | 0.56     | 3.24      | 1.62       | 2089            |
| 4        | 100% USDC, 0.5$ à 0.99$              | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 5        | 100% REG, 1.01$ à 1.5$               | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 6        | 100% USDC, 0.01$ à 0.1$              | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 7        | 100% REG, 100$ à 110$                | Inactif | 1.00$ | -        | 0         | 0          | 0               |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif   | 2.70$ | 0.06     | 1.24      | 0.62       | 235             |

**Notes importantes :**

1. Avec `inactiveBoost: 0`, toutes les positions inactives ont un pouvoir de vote nul. Si cette valeur était modifiée (par exemple à 0.5), ces positions conserveraient une partie de leur pouvoir de vote même lorsque le prix est en dehors de leur plage.
2. Bien que le scénario 1 montre une répartition égale entre REG et USDC, il s'agit d'une simplification pour la démonstration. Pour une plage [0.5$ - 1.5$] à un prix de 1.0$, un pool Uniswap V3 contiendrait normalement environ 38.5% REG et 61.5% USDC.
3. Les scénarios 2 et 3 montrent l'impact du prix actuel sur le calcul du centrage et du boost: plus le prix s'éloigne du centre de la plage, plus le boost diminue, même si la plage reste la même.
4. Pour rappel, un REG doit toujours donner du pouvoir de vote, quelle que soit son utilisation. Il est donc généralement préférable de ne pas mettre le paramètre `inactiveBoost` à 0.
5. Le scénario 8 illustre comment une position décentrée (prix très proche d'une borne) obtient un boost relativement faible avec le mode "centered", même si elle est active.

### Test :

Le fichier json comprenant les 10 wallets des exemples ci-dessus est disponible [ici](../../outDatas/balancesREG_mock_reel_pool_dex.json)

Le calculateur a été appliqué à ce jeu de données, et les résultats (powerVoting) avec les paramètres mentionnés ci-dessus (sauf `inactiveBoost`, qui est à 1 par défaut) sont disponibles [ici](../../outDatas/Test%20linear%20centered%20decimals%20.png)

## Fonctionnement "boostMode: proximity"

Lorsque `boostMode` est défini sur `"proximity"`, le calcul du boost change radicalement. Au lieu de se baser sur le centrage de la plage, il évalue la proximité de la liquidité par rapport au prix actuel du pool. Ce mode est conçu pour récompenser la liquidité qui est "active" ou "inactive" et proche du prix de marché, là où elle est la plus utile.

**Principes clés du mode "proximity" (pour `priceRangeMode: "linear"`)**:

1.  **Calcul par Tranche (Slice)**: La liquidité est analysée par tranches (définies par `sliceWidth`). Le `sliceWidth` a une valeur par défaut de `1` pour `sourceValue: "tick"` et `0.1` pour `sourceValue: "priceDecimals"`.
2.  **Décroissance du Boost**: Le boost est maximal (`maxBoost`) pour la tranche contenant le prix actuel et diminue linéairement à mesure que l'on s'éloigne du prix actuel, jusqu'à atteindre `minBoost`.
3.  **Paramètres de Décroissance (`decaySlices`, `decaySlicesDown`, `decaySlicesUp`)**: Ces paramètres déterminent sur combien de tranches cette décroissance s'opère. `decaySlices` est une valeur générique, tandis que `decaySlicesDown` et `decaySlicesUp` permettent de définir des taux de décroissance différents selon que l'on s'éloigne du prix vers le bas ou vers le haut.
4.  **Gestion des Bornes (`valueLower`, `valueUpper`)**: Pour une position active, le calcul se fait par rapport à l'une des bornes de la position. La fonction `calculateProximityBoost` attend que l'une des deux bornes soit `null` pour déterminer la direction. Typiquement :
    - Pour le token qui diminue si le prix monte (Token0, ex: REG dans REG/USDC si REG est T0), on se base sur `valueUpper` (le `maxPrice` de la position LP), et `valueLower` est `null`. La direction est "montante".
    - Pour le token qui diminue si le prix baisse (Token1, ex: USDC dans REG/USDC si USDC est T1), on se base sur `valueLower` (le `minPrice` de la position LP), et `valueUpper` est `null`. La direction est "descendante".
5.  **Positions Hors Plage (`outOfRangeEnabled`)**: Si `outOfRangeEnabled` est `true` (par défaut), un boost peut quand même être calculé pour la liquidité hors plage, en considérant la borne la plus proche de la position. Le boost décroît rapidement.
6.  **Boost Final**: Le boost calculé pour chaque tranche est pondéré par la portion de liquidité de l'utilisateur dans cette tranche. Le code actuel calcule un `averageBoost` basé sur la somme des boosts pondérés divisée par le nombre total de tranches théoriques jusqu'à la borne de référence de la position.

**Configuration typique pour `priceRangeMode: "linear"` et `boostMode: "proximity"`**:

```typescript
{
  sushiswap: {
    default: {
      REG: 4, // Multiplicateur de base pour REG
      "*": 2  // Multiplicateur de base pour tous les autres tokens
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "linear",
        boostMode: "proximity",
        maxBoost: 5,
        minBoost: 1,
        // Pour priceDecimals, un sliceWidth de 0.01 pourrait représenter 1% de changement de prix
        sliceWidth: 0.05, //  chaque tranche représente une variation de 0.05$ du prix
        decaySlicesDown: 10, // Atteint minBoost en 10 tranches vers le bas (0.5$ de variation)
        decaySlicesUp: 10,   // Atteint minBoost en 10 tranches vers le haut (0.5$ de variation)
        outOfRangeEnabled: true
    }
  }
}
```

### Exemple de calcul pour `boostMode: "proximity"`

Utilisons le **Scénario 8** de `balancesREG_mock_examples.json` avec la configuration ci-dessus.

**Données du Scénario 8 (Position 1008) pour l'utilisateur 0x888...888**:

- Pool: REG/USDC (REG est token0, USDC est token1)
- Position LP: Range `[1.05$ - 2.75$]` (`minPrice` = 1.05, `maxPrice` = 2.75)
- Prix Actuel (`currentPrice`): `2.7$`
- Balance REG: 8.772 tokens
- Balance USDC: 976.28 tokens (équivalent à 361.585 REG au prix de 2.7$)
- La position est `isActive` car 1.05 <= 2.7 <= 2.75.

**Paramètres de boost (repris de la config type ci-dessus)**:

- `sourceValue`: "priceDecimals"
- `priceRangeMode`: "linear"
- `boostMode`: "proximity"
- `maxBoost`: 5
- `minBoost`: 1
- `sliceWidth`: 0.05
- `decaySlicesDown`: 10 (utilisé pour USDC, car on s'éloigne du prix actuel de 2.7$ vers le `minPrice` de 1.05$)
- `decaySlicesUp`: 10 (utilisé pour REG, car on s'éloigne du prix actuel de 2.7$ vers le `maxPrice` de 2.75$)
- `outOfRangeEnabled`: true
- Multiplicateur par défaut REG: 4
- Multiplicateur par défaut USDC: 2

**Calcul du boost pour le REG (Token0)**:

1.  `valueLower` est `null`, `valueUpper` est `2.75` (maxPrice de la position).
2.  Le prix actuel est `currentValue = 2.7`.
3.  La borne de référence (`bnEffectiveReferencePoint`) est `2.75`.
4.  Direction: `1` (vers le haut, de `currentValue` vers `bnEffectiveReferencePoint`).
5.  Largeur totale de la liquidité pertinente (`bnTotalLiquidityWidth`): `|2.7 - 2.75| = 0.05`.
6.  Nombre total de tranches théoriques (`bnTotalSlicesInLiquidity`): `0.05 / 0.05 = 1` tranche.
7.  `decaySlices` pertinent est `decaySlicesUp = 10`.

    - **Tranche 1 (i=0)**: de 2.7 à 2.75 (portion = 1).
      - `slicesAway = 0`.
      - `decayProgress = 0 / 10 = 0`.
      - `sliceBoostNum = 5 - (5 - 1) * 0 = 5`.
      - `bnTotalBoostAccumulated = 5 * 1 = 5`.

8.  `averageBoost = 5 / 1 = 5`.
9.  Boost final pour REG = `5 * 1 = 5`.

**Calcul du boost pour l'USDC (Token1)**:

1.  `valueLower` est `1.05` (minPrice de la position), `valueUpper` est `null`.
2.  Le prix actuel est `currentValue = 2.7`.
3.  La borne de référence (`bnEffectiveReferencePoint`) est `1.05`.
4.  Direction: `-1` (vers le bas, de `currentValue` vers `bnEffectiveReferencePoint`).
5.  Largeur totale de la liquidité pertinente (`bnTotalLiquidityWidth`): `|2.7 - 1.05| = 1.65`.
6.  Nombre total de tranches théoriques (`bnTotalSlicesInLiquidity`): `1.65 / 0.05 = 33` tranches.
7.  `decaySlices` pertinent est `decaySlicesDown = 10`.

    - **Tranche 1 (i=0)**: de 2.7 à 2.65 (portion = 1).
      - `sliceBoostNum = 5`.
    - **Tranche 2 (i=1)**: de 2.65 à 2.60 (portion = 1).
      - `sliceBoostNum = 4.6`.
    - ... (ainsi de suite)
    - **Tranche 10 (i=9)**: de 2.25 à 2.20.
      - `sliceBoostNum = 1.4`.
    - **Tranche 11 (i=10) et suivantes**: Le `sliceBoostNum` reste à `minBoost = 1`.

    `bnTotalBoostAccumulated = 32` (pour les 10 premières tranches) `+ 23 * 1` (pour les 23 tranches restantes) `= 55`.

8.  `averageBoost = 55 / 33 ≈ 1.6667`.
9.  Boost final pour USDC = `1.6667 * 0.5 = 0.8333`.

**Pouvoir de vote pour le Scénario 8 (Position 1008)**:

- REG: `8.772 tokens × 5 = 43.86`
- USDC: `361.585 equivalent REG × 0.8333... = 301.32`
- **Total: `43.86 + 301.32 = 345.18`**

**Analyse de cet exemple en mode "proximity"**:

- Le REG, étant très proche de sa borne supérieure (`maxPrice` de 2.75$ alors que le prix est à 2.7$), reçoit un `maxBoost` de 5. Cela est logique car cette partie de la liquidité est la plus susceptible d'être utilisée si le prix du REG monte légèrement.
- L'USDC, bien qu'actif, est réparti sur une plus grande distance par rapport au prix actuel (de 2.7$ jusqu'à 1.05$). Les tranches d'USDC les plus proches du prix actuel reçoivent un boost élevé, mais ce boost diminue pour les tranches plus éloignées, jusqu'à atteindre `minBoost`. L'`averageBoost` reflète cela.
- Ce mode récompense la concentration de liquidité autour du prix actuel de manière plus granulaire que le mode `centered`.
- Le scénario 8 illustre bien la différence entre les modes "centered" et "proximity" : en mode "centered", cette position obtient un boost faible (1.24) car elle est décentrée, mais en mode "proximity", elle obtient un boost élevé (5.0) pour le REG car la liquidité est très proche du prix actuel.
- Les paramètres `sliceWidth` et `decaySlices` sont cruciaux pour affiner la sensibilité de ce mode.

### Comparaison des résultats pour les autres scénarios en mode "proximity"

En appliquant la même configuration et méthode de calcul aux autres scénarios, voici les résultats que nous pourrions obtenir (avec `outOfRangeEnabled: false`):

| Scénario | Description                          | État    | Prix  | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------------ | ------- | ----- | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif   | 1.00$ | 3.2       | 1.6        | 2400            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif   | 0.63$ | 2.26      | 2.33       | 2287            |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif   | 1.22$ | 4.07      | 1.26       | 2076            |
| 4        | 100% USDC, 0.5$ à 0.99$              | Inactif | 1.00$ | -         | 1          | 500             |
| 5        | 100% REG, 1.01$ à 1.5$               | Inactif | 1.00$ | 1         | -          | 1000            |
| 6        | 100% USDC, 0.01$ à 0.1$              | Inactif | 1.00$ | -         | 1          | 500             |
| 7        | 100% REG, 100$ à 110$                | Inactif | 1.00$ | 1         | -          | 1000            |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif   | 2.70$ | 5.00      | 0.83       | 345             |

**Notes sur la proximité:**

1. En mode proximity, la position du prix au sein de la plage importe plus que la centralité globale de la plage.
2. Les positions avec de la liquidité concentrée proche du prix actuel obtiennent un boost beaucoup plus élevé.
3. Avec `outOfRangeEnabled: true` et si le prix était proche d'une position inactive, celle-ci pourrait encore recevoir un boost significatif.
4. La distribution de boost n'est pas symétrique: elle dépend de la distribution réelle de la liquidité dans les deux tokens.

### Impact du paramètre outOfRangeEnabled sur les positions inactives

Une caractéristique importante du mode "proximity" est la possibilité de prendre en compte les positions actuellement inactives mais proches du prix actuel grâce au paramètre `outOfRangeEnabled: true`. Voici comment les résultats changeraient si l'on activait ce paramètre avec les mêmes configurations que précédemment:

| Scénario | Description                          | État    | Prix  | Distance au prix | Boost inactif | Pouvoir de vote |
| -------- | ------------------------------------ | ------- | ----- | ---------------- | ------------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif   | 1.00$ | Dans la plage    | -             | 2400            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif   | 0.63$ | Dans la plage    | -             | 2287            |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif   | 1.22$ | Dans la plage    | -             | 2076            |
| 4        | 100% USDC, 0.5$ à 0.99$              | Inactif | 1.00$ | 0.01$ (1%)       | 1.07          | 1071            |
| 5        | 100% REG, 1.01$ à 1.5$               | Inactif | 1.00$ | 0.01$ (1%)       | 2.14          | 2142            |
| 6        | 100% USDC, 0.01$ à 0.1$              | Inactif | 1.00$ | 0.90$ (900%)     | 0.50          | 500             |
| 7        | 100% REG, 100$ à 110$                | Inactif | 1.00$ | 99.00$ (9900%)   | 1.00          | 1000            |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif   | 2.70$ | Dans la plage    | -             | 345             |

_Note sur le calcul du "Boost inactif", pour le scénario 5 :_ 
- Le calcul est executé à partir du prix (1$) et jusqu'à la limite du range [1,10$ à 1,5$] la plus éloignée (soit 1,5$). Le calcul se fait par tranche (de 0,05), il y en aura donc 10. Le Boost va passer de son maximum (5) à son minimum (1) en 5 tranches (nota : Lorsqu'on est outOfRange, le `decayslice` (10) est réduit de moitié, afin que la décroissance soit plus rapide). Les tranches suivantes seront au minimum (1).
- Premier tranche : Le range [1.01$ à 1.5$] est distant du prix (1$) de 0.01$, soit moins qu'une tranche de calcul(0.05). La première tranche est donc traité avec le maxboost (5), auquel est appliqué une "portion", qui correspond à la portion du range (0.04) inclus dans le tranche de calcul (0.05), soit 0.8*5 = un boost de 4.
- Seconde tranche :  Le `decayProgress` est calculé comme `1 / decaySlices` (soit `1/5 = 0.2`). Le boost est alors `minBoost + (maxBoost - minBoost) * (1 - decayProgress)` soit `1 + (5-1) * (1 - 0.2) = 1 + 3.2 = 4.2`. 
- Tranches suivantes : Le `decayProgress` est augmenté de 1/5 à chaque tranche, jusqu'à 1. Ce qui donne les boosts suivants : 3.4, puis 2.6, puis 1.8, puis 1. Pour toutes les tranches suivantes, le boost sera au minimum soit 1, jusqu'à la fin du range (1.5$)
- la somme de tous des boosts de chaque tranches :  4 + 4.2 + 3.4 + 2.6 + 1.8 + 1 + 1 + 1 + 1 + 1 = 21, est divisé par le nombre de tranches en tenant compte de la "portion" de la première, soit 9.8 tranches. Le boost moyen est donc 21 / 9.8 = 2.14

**Avantages d'inclure les positions inactives proches du prix actuel:**

1. **Récompense la liquidité potentiellement utilisable**: Les positions juste à la frontière du prix actuel (comme les scénarios 4 et 5) peuvent devenir actives avec une très légère fluctuation du prix. Cette liquidité est donc pratiquement utilisable et mérite d'être valorisée.

2. **Encourage le resserrement des plages**: Ce mécanisme incite les fournisseurs de liquidité à positionner leurs plages au plus près du prix actuel, même si elles sont temporairement inactives. Cela améliore la profondeur du marché autour du prix de référence.

3. **Réduction de l'effet de seuil**: Sans cette approche, le passage d'une position de active à inactive (ou inversement) peut provoquer un changement brutal du pouvoir de vote. Ce mécanisme adoucit cette transition en créant un gradient basé sur la proximité.

4. **Différenciation stratégique**: Comme le montre le tableau, les positions très éloignées (scénarios 6 et 7) reçoivent toujours un boost minimal, tandis que les positions proches (scénarios 4 et 5) sont presque aussi valorisées que les positions actives.

5. **Résistance aux manipulations**: Ce système rend plus difficile l'optimisation artificielle du pouvoir de vote en positionnant la liquidité juste à l'extérieur de la plage active.

Cette approche permet une distribution plus équitable et stratégiquement pertinente du pouvoir de vote, en valorisant non seulement la liquidité actuellement utilisable, mais aussi celle qui pourrait rapidement le devenir en cas de légères fluctuations du marché.

### Test :

Le calculateur a été appliqué au jeu de données (des 10 wallets), et les résultats (powerVoting) avec les paramètres mentionnés ci-dessus sont disponibles [ici](../../outDatas/Test%20linear%20proximity%20decimals.png)

## Comparaison directe des modes "centered" et "proximity"

Le tableau suivant permet de comparer directement les résultats des deux modes de boost pour les scénarios actifs:

| Scénario | Description                          | État  | Prix  | Mode Centered |         | Mode Proximity |         |
| -------- | ------------------------------------ | ----- | ----- | ------------- | ------- | -------------- | ------- |
|          |                                      |       |       | Boost REG     | Pouvoir | Boost REG      | Pouvoir |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif | 1.00$ | 5.00          | 3750    | 3.2            | 2400    |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif | 0.63$ | 2.04          | 1688    | 2.26           | 2287    |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif | 1.22$ | 3.24          | 2089    | 4.07           | 2076    |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif | 2.70$ | 1.24          | 235     | 5.00           | 345     |

Observations importantes:

1. Pour une position parfaitement centrée (scénario 1), le mode centered donne la performance maximum. Le mode proximity donne un résultat moindre, car moyenné sur toutes les tranches de calcul.
2. Pour les positions décentrées mais avec un prix à proximité (scénarios 2, 3, 8), le mode "proximity" offre généralement des boosts plus élevés.
3. Le scénario 8 montre la différence la plus importante: en "centered", il obtient un faible boost de 1.24 car très décentré (0.06), mais en "proximity", il obtient le boost maximum de 5.0 pour la partie REG car celle-ci est très proche du prix actuel.
4. Le mode "proximity" tend à valoriser davantage la liquidité globale dans les positions actives, ce qui peut être préférable pour encourager la liquidité utilisable.
