import { Router } from "express";

import {
  createAddressController,
  listAddressesController,
  getAddressByIdController,
  updateAddressController,
  setDefaultAddressController,
  deleteAddressController,
} from "../controllers/addressController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Customer Address Routes
|--------------------------------------------------------------------------
|
| All address endpoints require customer authentication.
| The authenticated customer's ID comes from the verified JWT.
|
*/

router.use(authMiddleware);

/*
|--------------------------------------------------------------------------
| 1. List Customer Addresses
|--------------------------------------------------------------------------
| GET /api/v1/addresses
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  listAddressesController
);

/*
|--------------------------------------------------------------------------
| 2. Create Address
|--------------------------------------------------------------------------
| POST /api/v1/addresses
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  createAddressController
);

/*
|--------------------------------------------------------------------------
| 3. Set Default Address
|--------------------------------------------------------------------------
| PATCH /api/v1/addresses/:addressId/default
|--------------------------------------------------------------------------
*/

router.patch(
  "/:addressId/default",
  setDefaultAddressController
);

/*
|--------------------------------------------------------------------------
| 4. Get Address By ID
|--------------------------------------------------------------------------
| GET /api/v1/addresses/:addressId
|--------------------------------------------------------------------------
*/

router.get(
  "/:addressId",
  getAddressByIdController
);

/*
|--------------------------------------------------------------------------
| 5. Update Address
|--------------------------------------------------------------------------
| PATCH /api/v1/addresses/:addressId
|--------------------------------------------------------------------------
*/

router.patch(
  "/:addressId",
  updateAddressController
);

/*
|--------------------------------------------------------------------------
| 6. Delete Address
|--------------------------------------------------------------------------
| DELETE /api/v1/addresses/:addressId
|--------------------------------------------------------------------------
*/

router.delete(
  "/:addressId",
  deleteAddressController
);

export default router;