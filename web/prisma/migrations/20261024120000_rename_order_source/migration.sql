-- Orders from the desktop app used an older source name. Anything that is not a current
-- OrderSource value came from the desktop app, so it becomes DESKTOP.
UPDATE "Order" SET "source" = 'DESKTOP' WHERE "source" NOT IN ('WEB', 'DESKTOP', 'APP');
