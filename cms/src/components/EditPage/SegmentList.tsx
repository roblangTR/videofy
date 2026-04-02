"use client";
import { ManuscriptType } from "@videofy/types";
import { Flex, Form } from "antd";
import { FC } from "react";
import Segment from "./Segment";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cameraMovements, moods, textPlacements } from "@/utils/constants";

const SegmentList: FC<{
  index: number;
  manuscript: ManuscriptType;
}> = ({ index }) => {
  const form = Form.useFormInstance();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <Form.List name={[index, "manuscript", "segments"]}>
      {(segments, { add, remove, move }) => {
        const segmentList = form.getFieldValue([
          "tabs",
          index,
          "manuscript",
          "segments",
        ]);

        function handleDuplicate(segmentNumber: number) {
          const currentValue = form.getFieldValue([
            "tabs",
            index,
            "manuscript",
            "segments",
            segmentNumber,
          ]);
          add({ ...currentValue, id: Math.random() }, segmentNumber + 1);
        }

        function handleAdd(position: number) {
          add(
            {
              id: Math.random(),
              mood: moods[0]?.id,
              cameraMovement: cameraMovements[0]?.id,
              style: textPlacements[0]?.id,
              type: "segment",
            },
            position + 1
          );
        }

        function handleDragEnd(event: DragEndEvent) {
          const { active, over } = event;

          if (over && active.id !== over.id) {
            const oldIndex = segmentList.findIndex(
              (item: { id: string }) => item.id === active.id
            );
            const newIndex = segmentList.findIndex(
              (item: { id: string }) => item.id === over.id
            );

            move(oldIndex, newIndex);
          }
        }

        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={segmentList.map((s: { id: string }) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <Flex vertical gap="middle">
                {segments.map((segment, segmentIdx) => {
                  const id = segmentList[segment.name].id;
                  const position = segmentIdx;
                  return (
                    <Segment
                      key={id}
                      id={id}
                      manuscriptIndex={index}
                      position={position}
                      onDuplicate={() => handleDuplicate(position)}
                      onAdd={() => handleAdd(position)}
                      onRemove={() => remove(position)}
                    />
                  );
                })}
              </Flex>
            </SortableContext>
          </DndContext>
        );
      }}
    </Form.List>
  );
};

export default SegmentList;
