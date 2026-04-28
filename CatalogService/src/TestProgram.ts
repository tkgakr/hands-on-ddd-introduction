import { container } from "tsyringe";

import { MockDomainEventPublisher } from "Application/shared/DomainEvent/MockDomainEventPublisher";
import { MockTransactionManager } from "Application/shared/MockTransactionManager";
import { InMemoryBookRepository } from "Infrastructure/InMemory/Book/InMemoryBookRepository";
import { InMemoryEventStoreRepository } from "Infrastructure/InMemory/EventStore/InMemoryEventStoreRepository";
import { InMemoryEventSourcedReviewQueryRepository } from "Infrastructure/InMemory/Review/InMemoryEventSourcedReviewQueryRepository";

export const registerTestDependencies = (): void => {
  container.reset();

  const bookRepository = new InMemoryBookRepository();
  const eventStoreRepository = new InMemoryEventStoreRepository();

  container.register("IDomainEventPublisher", {
    useClass: MockDomainEventPublisher,
  });

  container.registerInstance("IBookRepository", bookRepository);
  container.registerInstance(InMemoryBookRepository, bookRepository);

  container.registerInstance("IEventStoreRepository", eventStoreRepository);
  container.registerInstance(InMemoryEventStoreRepository, eventStoreRepository);

  container.register("IReviewQueryRepository", {
    useClass: InMemoryEventSourcedReviewQueryRepository,
  });

  container.register("ITransactionManager", {
    useClass: MockTransactionManager,
  });
};

registerTestDependencies();
