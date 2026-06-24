import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { logger } from "./logger";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(
    {
      hotelId: "lumen-sg",
      shiftDate: "system",
      step: "output",
    },
    `vouch-handover service running on port ${PORT}`
  );
});
