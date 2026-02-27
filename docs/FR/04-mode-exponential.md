# Mode "priceRangeMode: exponential"

Lorsque le paramètre `priceRangeMode` est défini sur `"exponential"` dans le fichier de configuration `src/configs/optionsModifiers.ts`, le système de calcul utilise une fonction exponentielle pour accentuer davantage les différences de boost en fonction du centrage.

De même que pour le mode "linear", il peut fonctionner avec deux logiques de calcul en fonction du paramètre `boostMode` :

- `boostMode: centered` : le boost est calculé en fonction du centrage de la plage par rapport au prix actuel, avec une variation exponentielle
- `boostMode: proximity` : le boost est calculé en fonction de la position relative du prix actuel par rapport aux différentes tranches de liquidités dans la plage

## Fonctionnement "boostMode: centered"

Dans ce mode, le calcul applique le boost maximum (paramètre `maxBoost`) au centre exact de la plage de prix, et un boost minimum (paramètre `minBoost`) aux extrémités de la plage.

La principale différence avec le mode "linear" est que la variation entre ces deux valeurs suit une courbe exponentielle au lieu d'une ligne droite, ce qui accentue davantage l'avantage d'être proche du centre. Cette variation est contrôlée par le paramètre `exponent` :

- Plus la valeur de `exponent` est élevée, plus la courbe est "abrupte", renforçant l'avantage d'être au centre exact
- Plus la valeur de `exponent` est basse (mais > 1), plus la courbe est "douce", répartissant le boost de manière plus équilibrée

Le paramètre `rangeWidthFactor` fonctionne de la même manière que pour le mode "linear" pour limiter ou valoriser la largeur de la plage.

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
        priceRangeMode: "exponential",
        boostMode: "centered",
        inactiveBoost: 1,
        maxBoost: 5,
        minBoost: 1,
        exponent: 3,
    }
  }
}
```

### Exemples détaillés de calcul de boost pour positions Uniswap V3 avec mode exponentiel 🔍

La configuration utilisée pour ces calculs est définie dans `optionsModifiers.ts` :

- `sourceValue: "priceDecimals"` (utilise les prix plutôt que les ticks)
- `priceRangeMode: "exponential"` (variation exponentielle du boost)
- `boostMode: "centered"` (favorise les positions centrées)
- `inactiveBoost: 1` (boost minimal pour les positions inactives)
- `maxBoost: 5` (boost maximal au centre de la plage)
- `minBoost: 1` (boost minimal aux extrémités de la plage)
- `exponent: 3` (contrôle la courbure de la fonction exponentielle)

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
4. **Facteur de largeur (rangeWidthFactorBoost)** = max(1, 1.0 / (pas de rangeWidthFactor défini)) = 1.0
5. **Boost exponentiel** = 1 + Math.pow(1.0, 3) × (5 - 1) = 1 + 1.0 × 4 = 5.0
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
4. **Facteur de largeur (rangeWidthFactorBoost)** = 1.0
5. **Boost exponentiel** = 1 + Math.pow(0.26, 3) × (5 - 1) = 1 + 0.018 × 4 = 1.07
6. **Boost final** = 1.07 × 1.0 = 1.07

#### Pouvoir de vote :

- REG: 655.22 × 1.07 (boost) × (4/4) = 701.09
- USDC: 344.78 × 1.070304 (boost précis) × (2/4) = 184.58
- **Total : 885.67**

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
4. **Facteur de largeur (rangeWidthFactorBoost)** = 1.0
5. **Boost exponentiel** = 1 + Math.pow(0.56, 3) × (5 - 1) = 1 + 0.176 × 4 = 1 + 0.704 = 1.70
6. **Boost final** = 1.70 × 1.0 = 1.70

#### Pouvoir de vote :

- REG: 289.32 × 1.702464 (boost précis) × (4/4) = 492.55
- USDC: 710.68 × 1.702464 (boost précis) × (2/4) = 604.96
- **Total : 1097.51**

### Scénario 4 : 100% USDC, range 0.5$ à 0.99$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.5$
- Prix max: 0.99$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

### Scénario 5 : 100% REG, range 1.01$ à 1.5$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 1.01$
- Prix max: 1.5$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

### Scénario 6 : 100% USDC, range 0.01$ à 0.1$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 0.01$
- Prix max: 0.1$
- Balance USDC équivalent REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- USDC: 1000 × 1 (boost) × (2/4) = 500
- **Total : 500**

### Scénario 7 : 100% REG, range 100$ à 110$

#### Données d'entrée :

- Position inactive (isActive: false) car prix actuel (1.0$) hors de la plage
- Prix min: 100$
- Prix max: 110$
- Balance REG: 1000 tokens
- Defaut Boost REG: 4
- Defaut Boost USDC: 2

#### Calcul du boost :

- Position inactive → boost = inactiveBoost = 1

#### Pouvoir de vote :

- REG: 1000 × 1 (boost) × (4/4) = 1000
- **Total : 1000**

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
4. **Facteur de largeur (rangeWidthFactorBoost)** = 1.0
5. **Boost exponentiel** = 1 + Math.pow(0.06, 3) × (5 - 1) = 1 + 0.000216 × 4 = 1.00086
6. **Boost final** = 1.00086 × 1.0 ≈ 1.001

#### Pouvoir de vote :

- REG: 8.772 × 1.001 (boost) × (4/4) = 8.78
- USDC: 361.585 × 1.001 (boost) × (2/4) = 180.97
- **Total : 189.75**

### Résumé des résultats

| Scénario | Description                          | État    | Prix  | Centrage | Boost REG | Boost USDC | Pouvoir de vote |
| -------- | ------------------------------------ | ------- | ----- | -------- | --------- | ---------- | --------------- |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | Actif   | 1.00$ | 1.00     | 5.00      | 2.50       | 3750            |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | Actif   | 0.63$ | 0.26     | 1.07      | 0.54       | 886             |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | Actif   | 1.22$ | 0.56     | 1.70      | 0.85       | 1098            |
| 4        | 100% USDC, 0.5$ à 0.99$              | Inactif | 1.00$ | -        | 1         | 0.50       | 500             |
| 5        | 100% REG, 1.01$ à 1.5$               | Inactif | 1.00$ | -        | 1         | 0.50       | 1000            |
| 6        | 100% USDC, 0.01$ à 0.1$              | Inactif | 1.00$ | -        | 1         | 0.50       | 500             |
| 7        | 100% REG, 100$ à 110$                | Inactif | 1.00$ | -        | 1         | 0.50       | 1000            |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | Actif   | 2.70$ | 0.06     | 1.001     | 0.501      | 190             |

**Notes importantes :**

1. Avec `inactiveBoost: 1`, toutes les positions inactives ont un pouvoir de vote égal à leur balance multipliée par le multiplicateur de base du token.
2. Contrairement au mode "linear", l'accentuation exponentielle (avec `exponent: 3`) crée une chute beaucoup plus rapide du boost lorsqu'on s'éloigne du centre exact.
3. On observe cette chute exponentielle clairement dans les scénarios 2 et 3 : malgré un centrage de 0.26 et 0.56 respectivement, leurs boosts (1.07 et 1.70) sont considérablement plus faibles que le boost maximal de 5.0 obtenu au centre parfait.
4. La différence est encore plus spectaculaire avec le scénario 8 : avec un centrage de seulement 0.06, le boost est à peine supérieur au minimum (1.001), alors qu'un mode linéaire aurait donné un boost de 1.24 pour la même position.
5. Cette configuration privilégie fortement les positions qui sont précisément centrées autour du prix actuel, ce qui encourage un comportement très stratégique dans le choix des plages de prix.
6. L'exposant 3 utilisé dans la configuration actuelle crée une courbe assez "sévère" - des valeurs plus basses comme 2 créeraient une transition plus douce entre le centre et les bords.

### Test :

Le fichier json comprenant les 10 wallets des exemples ci-dessus est disponible [ici](../../outDatas/balancesREG_mock_reel_pool_dex.json)

Le calculateur a été appliqué à ce jeu de données, et les résultats (powerVoting) avec les paramètres mentionnés ci-dessus sont disponibles [ici](../../outDatas/Test%20exponential%20centered%20decimals.png)

## Fonctionnement "boostMode: proximity"

Lorsque `boostMode` est défini sur `"proximity"` pour le `priceRangeMode: "exponential"`, le concept général reste similaire au mode linéaire en proximité, mais la décroissance du boost suit une courbe exponentielle. Cela signifie que le boost diminue plus rapidement (ou plus lentement, selon l'exposant) à mesure que l'on s'éloigne du prix actuel.

**Principes clés (similaires au mode linéaire en proximité, avec une formule de décroissance différente)**:

1.  **Calcul par Tranche (`sliceWidth`)**: Identique au mode linéaire/proximity.
2.  **Décroissance Exponentielle du Boost**: Le boost est `maxBoost` pour la tranche contenant le prix actuel et diminue de manière exponentielle jusqu'à `minBoost`.
    - La formule utilisée dans `calculateProximityBoost` est : `sliceBoostNum = minBoost + (maxBoost - minBoost) * Math.pow(1 - decayProgress, exponent)`
    - `decayProgress` est `slicesAway / decaySlicesRelevant` (où `decaySlicesRelevant` est `decaySlicesUp` ou `decaySlicesDown`).
    - Un `exponent` > 1 accentuera la chute du boost : il restera élevé près du prix actuel et tombera rapidement.
    - Un `exponent` < 1 (mais > 0) rendra la chute plus douce au début, puis plus rapide.
3.  **Paramètres de Décroissance (`decaySlices`, `decaySlicesDown`, `decaySlicesUp`)**: Identique au mode linéaire/proximity.
4.  **Gestion des Bornes (`valueLower`, `valueUpper`)**: Identique au mode linéaire/proximity.
5.  **Positions Hors Plage (`outOfRangeEnabled`)**: Identique au mode linéaire/proximity.
6.  **Exposant (`exponent`)**: Ce paramètre, déjà utilisé dans le mode `centered` exponentiel, contrôle ici la courbure de la décroissance du boost par tranche.

**Configuration typique pour `priceRangeMode: "exponential"` et `boostMode: "proximity"`**:

```typescript
{
  sushiswap: {
    default: {
      REG: 4,
      "*": 2
    },
    v3: {
        sourceValue: "priceDecimals",
        priceRangeMode: "exponential",
        boostMode: "proximity",
        maxBoost: 5,
        minBoost: 1,
        exponent: 2, // Pour une décroissance qui chute rapidement
        sliceWidth: 0.05,
        decaySlicesDown: 10,
        decaySlicesUp: 10,
        outOfRangeEnabled: true
    }
  }
}
```

### Exemple de calcul pour `boostMode: "proximity"` (Exponentiel)

Reprenons le **Scénario 8** de `balancesREG_mock_examples.json` avec la configuration exponentielle pour `boostMode: "proximity"` détaillée ci-dessus.

**Données du Scénario 8 et paramètres de boost**: Identiques à l'exemple pour `linear`/`proximity`, sauf que `priceRangeMode` est `"exponential"` et nous avons `exponent: 2`.

- Pool: REG/USDC (REG token0, USDC token1)
- Position LP: Range `[1.05$ - 2.75$]`, Prix Actuel: `2.7$`
- Balances: REG 8.772, USDC 976.28 (equiv. 361.585 REG)
- Paramètres: `maxBoost: 5`, `minBoost: 1`, `sliceWidth: 0.05`, `decaySlicesDown: 10`, `decaySlicesUp: 10`, `exponent: 2`.

**Calcul du boost pour le REG (Token0)**:

La logique de détermination des tranches est la même que pour le mode linéaire/proximity.

1.  `valueLower = null`, `valueUpper = 2.75` (maxPrice).
2.  `currentValue = 2.7`. `bnEffectiveReferencePoint = 2.75`. Direction = 1 (vers le haut).
3.  `bnTotalLiquidityWidth = |2.7 - 2.75| = 0.05`.
4.  `bnTotalSlicesInLiquidity = 0.05 / 0.05 = 1` tranche.
5.  `decaySlicesRelevant = decaySlicesUp = 10`.

    - **Tranche 1 (i=0)**: de 2.7 à 2.75.
      - `slicesAway = 0`.
      - `decayProgress = 0 / 10 = 0`.
      - `sliceBoostNum = minBoost + (maxBoost - minBoost) * Math.pow(1 - decayProgress, exponent)`
      - `sliceBoostNum = 1 + (5 - 1) * Math.pow(1 - 0, 2) = 1 + 4 * 1 = 5`.
      - `bnTotalBoostAccumulated = 5 * 1 = 5`.

6.  `averageBoost = 5 / 1 = 5`.
7.  Boost final pour REG = `5 * 1 = 5`.

**Calcul du boost pour l'USDC (Token1)**:

1.  `valueLower = 1.05` (minPrice), `valueUpper = null`.
2.  `currentValue = 2.7`. `bnEffectiveReferencePoint = 1.05`. Direction = -1 (vers le bas).
3.  `bnTotalLiquidityWidth = |2.7 - 1.05| = 1.65`.
4.  `bnTotalSlicesInLiquidity = 1.65 / 0.05 = 33` tranches.
5.  `decaySlicesRelevant = decaySlicesDown = 10`.

    - Pour les tranches de 0 à 9, le boost diminue selon la formule exponentielle.
    - À partir de la 10ème tranche, le boost reste à `minBoost = 1`.
    - Calcul pour quelques tranches:
      - Tranche 0 (2.70$ à 2.65$): `decayProgress = 0/10 = 0`, `boost = 1 + 4 * Math.pow(1 - 0, 2) = 5`
      - Tranche 1 (2.65$ à 2.60$): `decayProgress = 1/10 = 0.1`, `boost = 1 + 4 * Math.pow(1 - 0.1, 2) = 1 + 4 * 0.81 = 4.24`
      - Tranche 2 (2.60$ à 2.55$): `decayProgress = 2/10 = 0.2`, `boost = 1 + 4 * Math.pow(1 - 0.2, 2) = 1 + 4 * 0.64 = 3.56`
      - Tranche 9 (2.25$ à 2.20$): `decayProgress = 9/10 = 0.9`, `boost = 1 + 4 * Math.pow(1 - 0.9, 2) = 1 + 4 * 0.01 = 1.04`
      - Tranches 10 à 32: `boost = 1`

6.  `bnTotalBoostAccumulated` = somme de tous les boosts de tranche = 48.4
7.  `averageBoost = 48.4 / 33 = 1.466`.
8.  Boost final pour USDC = `1.466 * 0.5 = 0.733`.

**Pouvoir de vote pour le Scénario 8 (Exponentiel Proximity, exponent: 2)**:

- REG: `8.772 equivalent REG × 5 = 43.86`
- USDC: `361.585 equivalent REG × 0.733 = 265.16`
- **Pouvoir de vote total pour la position: `43.86 + 265.16 = 309.02`**

**Analyse de l'exemple en mode "proximity" exponentiel (exponent: 2)**:

- Le boost pour le REG, étant sur la tranche `slicesAway = 0`, reçoit toujours le `maxBoost`.
- Pour l'USDC, l'`averageBoost` (environ 1.47) est inférieur à celui obtenu avec le mode linéaire/proximity (environ 1.67). Avec `exponent: 2`, la décroissance du boost est plus rapide pour les premières tranches s'éloignant du prix actuel. La liquidité doit être encore plus proche pour bénéficier d'un boost élevé.
- Ce mode, avec un exposant supérieur à 1, est donc plus sélectif et récompense davantage la liquidité très concentrée autour du prix actuel par rapport à une décroissance linéaire.
- Comparé au mode "centered" qui donne un boost de seulement 1.001 pour ce scénario, le mode "proximity" offre un boost beaucoup plus élevé (5.0 pour REG et 0.73 pour USDC) car il valorise la proximité au prix actuel plutôt que le centrage de la plage.

### Test :

Le calculateur a été appliqué au jeu de données (des 10 wallets), et les résultats (powerVoting) avec les paramètres mentionnés ci-dessus sont disponibles [ici](../../outDatas/Test%20Exponential%20Proximity%20decimals.png)

### Tableau comparatif des modes "centered" et "proximity" en exponentiel

| Scénario | Description                          | Prix  | Mode Centered Exp. |         | Mode Proximity Exp. |         |
| -------- | ------------------------------------ | ----- | ------------------ | ------- | ------------------- | ------- |
|          |                                      |       | Boost REG          | Pouvoir | Boost REG           | Pouvoir |
| 1        | 50% USDC / 50% REG, 0.5$ à 1.5$      | 1.00$ | 5.00               | 3750    | 5.00                | 1905    |
| 2        | 75% REG / 25% USDC, 0.5$ à 1.5$      | 0.63$ | 1.07               | 886     | 3.80                | 1989    |
| 3        | 25% REG / 75% USDC, 0.5$ à 1.5$      | 1.22$ | 1.70               | 1098    | 4.12                | 1738    |
| 8        | 2.4% REG / 97.6% USDC, 1.05$ à 2.75$ | 2.70$ | 1.001              | 190     | 5.00                | 309     |

Cette comparaison illustre parfaitement la différence fondamentale entre les deux modes avec fonction exponentielle:

- Le mode "centered" pénalise très sévèrement les positions décentrées avec l'exposant 3
- Le mode "proximity" récompense fortement les positions ayant de la liquidité proche du prix actuel
- Pour le scénario 8, la différence est particulièrement frappante: 190 vs 309 de pouvoir de vote.
