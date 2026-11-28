import { Router } from 'express';
import { getShopItems, buyItem, equipItem } from '../controllers/shop.controller.js';
import { userAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', userAuth, getShopItems);
router.post('/buy/:itemId', userAuth, buyItem);
router.post('/equip/:itemId', userAuth, equipItem);

export default router;
