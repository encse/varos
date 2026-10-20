/**
 * Ugyanabból a várostérképből mindig ugyanott lesz park.
 * Csak elég nagy háztömböt cserélünk le, ezért az úthálózat érintetlen marad.
 */
export function isParkBlock(row: number, column: number, width: number, height: number) {
  return width >= 3.5
    && height >= 3.5
    && (row * 37 + column * 19 + 13) % 7 === 1
}
