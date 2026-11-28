import { User } from "../models/user.model.js";
import { SHOP_ITEMS } from "../config/shopItems.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getShopItems = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, SHOP_ITEMS, 'Shop items fetched'));
});

export const buyItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const item = SHOP_ITEMS.find((shopItem) => shopItem.id === itemId);

  if (!item) throw new ApiError(404, 'Item not found');

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found');

  if (user.ownedItems.includes(itemId)) {
    throw new ApiError(400, 'You already own this item');
  }
  if (user.brawlPoints < item.cost) {
    throw new ApiError(400, 'Not enough Brawl-Points');
  }

  user.brawlPoints -= item.cost;
  user.ownedItems.push(itemId);
  await user.save();

  res.status(200).json(new ApiResponse(200, {
    brawlPoints: user.brawlPoints,
    ownedItems: user.ownedItems,
  }, 'Purchase successful'));
});

export const equipItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found');

  if (!user.ownedItems.includes(itemId) && itemId !== 'default') {
    throw new ApiError(400, 'You do not own this item');
  }

  user.activeAvatar = itemId;
  await user.save();

  res.status(200).json(new ApiResponse(200, {
    activeAvatar: user.activeAvatar,
  }, 'Item equipped'));
});
