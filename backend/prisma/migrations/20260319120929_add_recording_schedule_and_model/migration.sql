-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "recordingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recordingEndTime" TEXT,
ADD COLUMN     "recordingStartTime" TEXT;

-- CreateTable
CREATE TABLE "Recording" (
    "id" SERIAL NOT NULL,
    "cameraId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSecs" INTEGER NOT NULL,
    "fileSizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recording_cameraId_startedAt_idx" ON "Recording"("cameraId", "startedAt");

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
