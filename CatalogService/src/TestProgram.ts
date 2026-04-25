import { container } from "tsyringe";

import { MockDomainEventPublisher } from "Application/shared/DomainEvent/MockDomainEventPublisher";
import { MockTransactionManager } from "Application/shared/MockTransactionManager";
import { InMemoryBookRepository } from "Infrastructure/InMemory/Book/InMemoryBookRepository";
import { InMemoryEventStoreRepository } from "Infrastructure/InMemory/EventStore/InMemoryEventStoreRepository";
import { InMemoryEventSourcedReviewQueryRepository } from "Infrastructure/InMemory/Review/InMemoryEventSourcedReviewQueryRepository";

// DomainEvent
container.register("IDomainEventPublisher", {
  useClass: MockDomainEventPublisher,
});

// repository
container.register("IBookRepository", {
  useClass: InMemoryBookRepository,
});

container.register("IReviewQueryRepository", {
  useClass: InMemoryEventSourcedReviewQueryRepository,
});

container.register("IEventStoreRepository", {
  useClass: InMemoryEventStoreRepository,
});

// transactionManager
container.register("ITransactionManager", {
  useClass: MockTransactionManager,
});
