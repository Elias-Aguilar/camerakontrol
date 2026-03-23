-- CreateTable
CREATE TABLE "Camera" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 554,
    "username" TEXT,
    "password" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'rtsp',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);
