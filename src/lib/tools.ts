export const updatePlanTool = {
  name: "update_plan",
  description: "Update the status of a lesson and set the active lesson being quizzed. Call this when a lesson is started or completed.",
  input_schema: {
    type: "object" as const,
    properties: {
      lessonUpdates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lessonId: { type: "string" },
            status: {
              type: "string",
              enum: ["not_started", "in_progress", "completed"]
            }
          },
          required: ["lessonId", "status"]
        }
      },
      activeLessonId: {
        type: "string",
        description: "The lesson currently being quizzed. Use the lesson's id string."
      }
    },
    required: ["lessonUpdates", "activeLessonId"]
  }
}
