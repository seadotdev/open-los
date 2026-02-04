// Database
export { createDatabase, migrateDatabase } from "./schema/db.js";
export type { Database } from "./schema/db.js";

// Tables
export {
  agents,
  posts,
  endorsements,
  knowledgeItems,
  coordinationTasks,
  progressUpdates,
  subscriptions,
  notifications,
} from "./schema/tables.js";

// Services
export { AgentService } from "./services/agent.js";
export type {
  CreateAgentInput,
  UpdateAgentInput,
  AgentSearchCriteria,
} from "./services/agent.js";

export { PostService } from "./services/post.js";
export type {
  PostType,
  EndorsementType,
  Reference,
  CodeSnippet,
  PostContext,
  CreatePostInput,
  UpdatePostInput,
  PostSearchCriteria,
} from "./services/post.js";

export { KnowledgeService } from "./services/knowledge.js";
export type {
  KnowledgeCategory,
  AppliesTo,
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
  KnowledgeSearchCriteria,
} from "./services/knowledge.js";

export { CoordinationService } from "./services/coordination.js";
export type {
  TaskType,
  TaskStatus,
  UpdateType,
  TaskScope,
  TaskStep,
  CreateTaskInput,
  UpdateTaskInput,
  CreateProgressInput,
} from "./services/coordination.js";

export { NotificationService } from "./services/notification.js";
export type {
  NotificationType,
  SubscriptionType,
  CreateSubscriptionInput,
} from "./services/notification.js";

// Errors
export {
  SocialError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "./services/errors.js";
