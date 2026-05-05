import { container } from "tsyringe";

import { MockDomainEventPublisher } from "Application/shared/DomainEvent/MockDomainEventPublisher";
import { SQLBookRepository } from "Infrastructure/SQL/Book/SQLBookRepository";
import { SQLEventStoreRepository } from "Infrastructure/SQL/EventStore/SQLEventStoreRepository";
import { SQLEventSourcedReviewQueryRepository } from "Infrastructure/SQL/Review/SQLEventSourcedReviewQueryRepository";
import { SQLClientManager } from "Infrastructure/SQL/SQLClientManager";
import { SQLTransactionManager } from "Infrastructure/SQL/SQLTransactionManager";

export const registerSQLTestDependencies = (): void => {
  container.reset();

  const clientManager = new SQLClientManager();

  container.register("IDomainEventPublisher", {
    useClass: MockDomainEventPublisher,
  });

  container.registerInstance(SQLClientManager, clientManager);

  container.register("IBookRepository", {
    useClass: SQLBookRepository,
  });

  container.register("IEventStoreRepository", {
    useClass: SQLEventStoreRepository,
  });

  container.register("IReviewQueryRepository", {
    useClass: SQLEventSourcedReviewQueryRepository,
  });

  container.register("ITransactionManager", {
    useClass: SQLTransactionManager,
  });
};
