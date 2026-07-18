/**
 * ClassiqueBuilder — builder de séance spécifique au format Classique :
 * blocs → exercices/consignes avec prescription libre, réorganisation dnd-kit,
 * import depuis la banque de blocs, enregistrement d'un bloc dans la banque.
 */
import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Save, Plus } from "lucide-react";
import { C } from "@/lib/theme";
import { genId } from "@/lib/energy/treeUtils";
import type { ClassiqueBlock, ClassiqueItem } from "@/types/specific";

const ORANGE = "#F5A623";

// ── Item row (sortable) ───────────────────────────────────────────────────────

function ItemRow({ blockId, item, onChange, onDelete }: {
  blockId: string;
  item: ClassiqueItem;
  onChange: (patch: Partial<ClassiqueItem>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `${blockId}::${item.id}` });

  const inputStyle: React.CSSProperties = {
    background: C.s2, border: `1px solid ${C.brd}`, borderRadius: 6,
    color: C.tx, fontSize: 12, padding: "6px 8px",
    fontFamily: "inherit", outline: "none", minWidth: 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.5 : 1,
        display: "flex", gap: 6, alignItems: "center",
      }}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ background: "none", border: "none", color: C.tx3, cursor: "grab", padding: 2, display: "flex" }}
      >
        <GripVertical size={13} />
      </button>
      <input
        value={item.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Exercice / consigne…"
        style={{ ...inputStyle, flex: 2 }}
      />
      <input
        value={item.prescription ?? ""}
        onChange={(e) => onChange({ prescription: e.target.value })}
        placeholder="4x30m, 5×8, 3'…"
        style={{ ...inputStyle, flex: 1.2 }}
      />
      <input
        value={item.rest ?? ""}
        onChange={(e) => onChange({ rest: e.target.value })}
        placeholder="Repos"
        style={{ ...inputStyle, width: 70 }}
      />
      <button
        onClick={onDelete}
        style={{ background: "none", border: "none", color: C.tx3, cursor: "pointer", padding: 2, display: "flex" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.r)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.tx3)}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Block card (sortable) ─────────────────────────────────────────────────────

function BlockCard({ block, onChange, onDelete, onSaveToBank }: {
  block: ClassiqueBlock;
  onChange: (patch: Partial<ClassiqueBlock>) => void;
  onDelete: () => void;
  onSaveToBank?: (block: ClassiqueBlock) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleItemDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = block.items.map((i) => `${block.id}::${i.id}`);
    const from = ids.indexOf(String(active.id));
    const to   = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange({ items: arrayMove(block.items, from, to) });
  }

  function updateItem(itemId: string, patch: Partial<ClassiqueItem>) {
    onChange({ items: block.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        opacity: isDragging ? 0.6 : 1,
        background: C.s1, border: `1px solid ${C.brd}`, borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      {/* Block header */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <button
          {...attributes}
          {...listeners}
          style={{ background: "none", border: "none", color: C.tx3, cursor: "grab", padding: 2, display: "flex" }}
        >
          <GripVertical size={15} />
        </button>
        <input
          value={block.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Titre du bloc…"
          style={{
            flex: 1, background: "transparent", border: "none",
            borderBottom: `1px solid ${C.brdL}`,
            color: C.tx, fontSize: 13, fontWeight: 700,
            fontFamily: "inherit", outline: "none", padding: "2px 0",
          }}
        />
        {onSaveToBank && (
          <button
            onClick={() => onSaveToBank(block)}
            title="Enregistrer ce bloc dans la banque"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 9px", borderRadius: 6,
              border: `1px solid ${ORANGE}40`, background: ORANGE + "12",
              color: ORANGE, fontSize: 10, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Save size={11} /> Banque
          </button>
        )}
        <button
          onClick={onDelete}
          style={{ background: "none", border: "none", color: C.tx3, cursor: "pointer", padding: 2, display: "flex" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.r)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.tx3)}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Items */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
        <SortableContext items={block.items.map((i) => `${block.id}::${i.id}`)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {block.items.map((item) => (
              <ItemRow
                key={item.id}
                blockId={block.id}
                item={item}
                onChange={(patch) => updateItem(item.id, patch)}
                onDelete={() => onChange({ items: block.items.filter((i) => i.id !== item.id) })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() => onChange({ items: [...block.items, { id: genId(), name: "" }] })}
        style={{
          marginTop: 8, display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 6,
          border: `1px dashed ${C.brdL}`, background: "transparent",
          color: C.tx3, fontSize: 11, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Plus size={11} /> Exercice / consigne
      </button>
    </div>
  );
}

// ── Builder ───────────────────────────────────────────────────────────────────

interface Props {
  blocks: ClassiqueBlock[];
  onChange: (blocks: ClassiqueBlock[]) => void;
  onImportFromBank: () => void;
  onSaveBlockToBank?: (block: ClassiqueBlock) => void;
}

export default function ClassiqueBuilder({ blocks, onChange, onImportFromBank, onSaveBlockToBank }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // Force remount of inner DndContexts when block order changes to keep ids stable
  const [, setVersion] = useState(0);

  function handleBlockDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to   = blocks.findIndex((b) => b.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(blocks, from, to));
    setVersion((v) => v + 1);
  }

  function updateBlock(id: string, patch: Partial<ClassiqueBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onChange={(patch) => updateBlock(block.id, patch)}
              onDelete={() => onChange(blocks.filter((b) => b.id !== block.id))}
              onSaveToBank={onSaveBlockToBank}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onChange([...blocks, { id: genId(), title: "", items: [{ id: genId(), name: "" }] }])}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "12px 0", borderRadius: 10,
            border: `1px dashed ${C.brdL}`, background: "transparent",
            color: C.tx2, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 150ms",
          }}
        >
          <Plus size={14} /> Bloc
        </button>
        <button
          onClick={onImportFromBank}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "12px 0", borderRadius: 10,
            border: `1px solid ${ORANGE}40`, background: ORANGE + "0D",
            color: ORANGE, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 150ms",
          }}
        >
          Importer depuis la banque de blocs
        </button>
      </div>
    </div>
  );
}
