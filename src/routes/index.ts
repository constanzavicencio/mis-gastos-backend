import { Router } from 'express';
import { budgetsRouter } from './budgets';
import { categoriesRouter } from './categories';
import { expensesRouter } from './expenses';
import { incomesRouter } from './incomes';
import { inventoryRouter } from './inventory';
import { plannerRouter } from './planner';
import { subscriptionsRouter } from './subscriptions';
import { usersRouter } from './users';

export const apiRouter = Router();

apiRouter.use('/users', usersRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/expenses', expensesRouter);
apiRouter.use('/budgets', budgetsRouter);
apiRouter.use('/incomes', incomesRouter);
apiRouter.use('/subscriptions', subscriptionsRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/planner', plannerRouter);
