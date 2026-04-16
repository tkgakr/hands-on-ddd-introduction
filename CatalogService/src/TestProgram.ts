import { container } from "tsyringe";

import { MockDomainEventPublisher } from "Application/shared/DomainEvent/MockDomainEventPublisher";
import { MockTransactionManager } from "Application/shared/MockTransactionManager";
import { InMemoryBookRepository } from "Infrastructure/InMemory/Book/InMemoryBookRepository";
import { InMemoryEventStoreRepository } from "Infrastructure/InMemory/EventStore/InMemoryEventStoreRepository";
import { InMemoryReviewRepository } from "Infrastructure/InMemory/Review/InMemoryReviewRepository";

// DomainEvent
container.register("IDomainEventPublisher", {
  useClass: MockDomainEventPublisher,
});

// repository
container.register("IBookRepository", {
  useClass: InMemoryBookRepository,
});

container.register("IReviewRepository", {
  useClass: InMemoryReviewRepository,
});

container.register("IEventStoreRepository", {
  useClass: InMemoryEventStoreRepository,
});

// transactionManager
container.register("ITransactionManager", {
  useClass: MockTransactionManager,
});
