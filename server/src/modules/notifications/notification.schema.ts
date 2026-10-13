import { z } from "zod";
import { paginationQuerySchema } from "../../shared/utils/pagination.js";
import { optionalQuery, queryBoolean } from "../../shared/utils/query.js";

export const notificationListQuerySchema = paginationQuerySchema.extend({
  unreadOnly: optionalQuery(queryBoolean),
});

export const notificationIdParamsSchema = z.object({ id: z.uuid() });

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;