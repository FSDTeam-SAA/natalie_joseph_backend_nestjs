ALTER TABLE "companions"
ADD COLUMN "whatsappPhoneNumber" TEXT,
ADD COLUMN "whatsappPhoneNumberId" TEXT,
ADD COLUMN "whatsappDisplayName" TEXT,
ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappWelcomeMessage" TEXT;

CREATE UNIQUE INDEX "companions_whatsappPhoneNumber_key" ON "companions"("whatsappPhoneNumber");
CREATE UNIQUE INDEX "companions_whatsappPhoneNumberId_key" ON "companions"("whatsappPhoneNumberId");
