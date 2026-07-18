/**
 * ClassiquePreview — aperçu lecture seule d'une séance au format Classique.
 */
import { C } from "@/lib/theme";
import type { ClassiqueBlock } from "@/types/specific";

const ORANGE = "#F5A623";

export default function ClassiquePreview({ blocks }: { blocks: ClassiqueBlock[] }) {
  const realBlocks = blocks.filter((b) => b.title.trim() || b.items.some((i) => i.name.trim()));

  if (realBlocks.length === 0) {
    return (
      <div style={{ color: C.tx3, fontSize: 12, textAlign: "center", paddingTop: 40 }}>
        Ajoute des blocs pour voir l'aperçu
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {realBlocks.map((block, idx) => (
        <div key={block.id} style={{ background: C.s1, borderRadius: 10, border: `1px solid ${C.brd}`, overflow: "hidden" }}>
          <div style={{
            padding: "8px 12px", background: ORANGE + "0D",
            borderBottom: `1px solid ${C.brd}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE }}>{idx + 1}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.tx }}>{block.title || "Bloc"}</span>
            <span style={{ fontSize: 10, color: C.tx3, marginLeft: "auto" }}>
              {block.items.filter((i) => i.name.trim()).length} exo{block.items.filter((i) => i.name.trim()).length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ padding: "6px 12px 8px" }}>
            {block.items.filter((i) => i.name.trim()).map((item) => (
              <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${C.brd}30` }}>
                <span style={{ fontSize: 11, color: C.tx, flex: 1, minWidth: 0 }}>{item.name}</span>
                {item.prescription && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: ORANGE, flexShrink: 0 }}>{item.prescription}</span>
                )}
                {item.rest && (
                  <span style={{ fontSize: 10, color: C.tx3, flexShrink: 0 }}>R : {item.rest}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
