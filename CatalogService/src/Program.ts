import { container } from "tsyringe";

import { EventEmitterDomainEventPublisher } from "Infrastructure/EventEmitter/EventEmitterDomainEventPublisher";
import { EventEmitterDomainEventSubscriber } from "Infrastructure/EventEmitter/EventEmitterDomainEventSubscriber";
import { SQLBookRepository } from "Infrastructure/SQL/Book/SQLBookRepository";
import { SQLEventStoreRepository } from "Infrastructure/SQL/EventStore/SQLEventStoreRepository";
import { SQLEventSourcedReviewQueryRepository } from "Infrastructure/SQL/Review/SQLEventSourcedReviewQueryRepository";
import { SQLTransactionManager } from "Infrastructure/SQL/SQLTransactionManager";

// DomainEvent
container.register("IDomainEventPublisher", {
  useClass: EventEmitterDomainEventPublisher,
});
container.register("IDomainEventSubscriber", {
  useClass: EventEmitterDomainEventSubscriber,
});

// repository
container.register("IBookRepository", {
  useClass: SQLBookRepository,
});

container.register("IReviewQueryRepository", {
  useClass: SQLEventSourcedReviewQueryRepository,
});

container.register("IEventStoreRepository", {
  useClass: SQLEventStoreRepository,
});

// transactionManager
container.register("ITransactionManager", {
  useClass: SQLTransactionManager,
});
