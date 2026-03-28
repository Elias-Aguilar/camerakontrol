-- AlterTable: ventanas múltiples (máx. 3) en JSON; migra horario único anterior
ALTER TABLE "Camera" ADD COLUMN "recordingWindows" JSONB;

UPDATE "Camera"
SET "recordingWindows" = jsonb_build_array(
  jsonb_build_object(
    'start', "recordingStartTime",
    'end', "recordingEndTime"
  )
)
WHERE "recordingStartTime" IS NOT NULL
  AND "recordingEndTime" IS NOT NULL
  AND TRIM("recordingStartTime") <> ''
  AND TRIM("recordingEndTime") <> '';

UPDATE "Camera" SET "recordingWindows" = '[]'::jsonb WHERE "recordingWindows" IS NULL;

ALTER TABLE "Camera" DROP COLUMN "recordingStartTime";
ALTER TABLE "Camera" DROP COLUMN "recordingEndTime";
