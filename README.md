# VÁROS.EXE — React/TypeScript port

Az 2000-es C++/GRX20 forgalomszimulátor böngészős átirata. Induláskor véletlen várost és hozzá illő autóállományt generál; nincs fájlmentés vagy -betöltés.

Az eredeti C++ projekt teljes anyaga az [`original-src`](original-src) könyvtárban található.

## Indítás

```bash
npm install
npm run dev
```

Produkciós build és teszt:

```bash
npm test
npm run build
```

## Használat

- `Space`: indítás / szünet
- `→` vagy `Enter`: egy szimulációs kör
- `R`: újraindítás az aktuális inputtal

A **Város generálása** gomb egy kattintással új várost és hozzá illő autóállományt készít: 2–5 oszlop és sor, 4–8 egységes utcahossz, a város méretéhez igazított 80–400 autó. Minden kattintás automatikusan új véletlen seedet kap. A generálás után a szimuláció szünetel; az indítás gombbal folytatható, a reset pedig az aktuális várost indítja újra.

A kis előnézetre kattintva animáltan felcserélhető a nagy 3D dioráma és a 2D forgalmi radar. Mindkét nézet folyamatosan ugyanazt a szimulációt mutatja. A nagy 3D nézet húzással forgatható, görgővel nagyítható és jobb egérgombbal mozgatható. Az alsó vezérlő- és státuszsáv keskeny képernyőn több sorba rendeződik.

## 3D modellek

A WebGL-nézet a Kenney CC0 licencű **City Kit (Commercial)**, **City Kit (Roads)** és **Car Kit** GLB modelljeit használja. A csomagok eredeti licencfájljai a modellek mellett, a `public/models/kenney` könyvtárban találhatók.

## A port felépítése

A szimuláció az eredeti osztály- és metódusneveket tartja meg: `Auto`, `Sor`, `Kereszt`, `varos`, továbbá többek között `go`, `turn`, `mozgat`, `clock`, `ujkor`, `beolvas` és `betesz`. A megfelelő publikus modulok: `car.ts`, `sor.ts`, `kereszt.ts`, `varos.ts`. A GRX rajzolóhívások helyét egy külön canvas-renderer vette át; a forgalmi állapotgép ettől független.
