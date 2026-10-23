CREATE TABLE "frames" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "image_url" TEXT,
  "rarity" TEXT NOT NULL,
  "price_credits" INTEGER,
  "acquisition" TEXT NOT NULL,
  "mission_key" TEXT,
  "scale" DECIMAL(5,2) NOT NULL DEFAULT 1.30,
  "text_inset_left" DECIMAL(5,2),
  "text_inset_right" DECIMAL(5,2),
  "text_inset_top" DECIMAL(5,2),
  "text_inset_bottom" DECIMAL(5,2),
  "text_color" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "frames_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "frames_type_check" CHECK ("type" IN ('avatar', 'name')),
  CONSTRAINT "frames_rarity_check" CHECK ("rarity" IN ('common', 'rare', 'epic', 'legendary')),
  CONSTRAINT "frames_acquisition_check" CHECK ("acquisition" IN ('shop', 'mission', 'both', 'admin')),
  CONSTRAINT "frames_price_check" CHECK ("price_credits" IS NULL OR "price_credits" >= 0)
);

CREATE UNIQUE INDEX "frames_slug_key" ON "frames"("slug");
CREATE INDEX "frames_type_is_active_sort_order_idx" ON "frames"("type", "is_active", "sort_order");

CREATE TABLE "user_frames" (
  "user_id" TEXT NOT NULL,
  "frame_id" TEXT NOT NULL,
  "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  CONSTRAINT "user_frames_pkey" PRIMARY KEY ("user_id", "frame_id"),
  CONSTRAINT "user_frames_source_check" CHECK ("source" IN ('purchase', 'mission', 'gift', 'admin')),
  CONSTRAINT "user_frames_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_frames_frame_id_fkey" FOREIGN KEY ("frame_id") REFERENCES "frames"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_frames_frame_id_idx" ON "user_frames"("frame_id");

ALTER TABLE "User"
  ADD COLUMN "equipped_avatar_frame_id" TEXT,
  ADD COLUMN "equipped_name_frame_id" TEXT,
  ADD CONSTRAINT "User_equipped_avatar_frame_id_fkey"
    FOREIGN KEY ("equipped_avatar_frame_id") REFERENCES "frames"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "User_equipped_name_frame_id_fkey"
    FOREIGN KEY ("equipped_name_frame_id") REFERENCES "frames"("id") ON DELETE SET NULL ON UPDATE CASCADE;
