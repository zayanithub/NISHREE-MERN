import {
  createAddress as createAddressService,
  listAddresses as listAddressesService,
  getAddressById as getAddressByIdService,
  updateAddress as updateAddressService,
  setDefaultAddress as setDefaultAddressService,
  deleteAddress as deleteAddressService,
} from "../service/addressService.js";

/*
|--------------------------------------------------------------------------
| Common Helper
|--------------------------------------------------------------------------
*/

const requireCustomer = (req, res) => {
  const userId = req.auth?.userId;

  if (
    !userId ||
    req.auth?.accountType !== "user"
  ) {
    res.status(401).json({
      success: false,
      message: "Customer authentication required.",
    });

    return null;
  }

  return userId;
};

/*
|--------------------------------------------------------------------------
| 1. Create Address
|--------------------------------------------------------------------------
| POST /api/v1/addresses
|--------------------------------------------------------------------------
*/

export const createAddressController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const address = await createAddressService(
      userId,
      body
    );

    return res.status(201).json({
      success: true,
      message: "Address created successfully.",
      address,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Customer Addresses
|--------------------------------------------------------------------------
| GET /api/v1/addresses
|--------------------------------------------------------------------------
*/

export const listAddressesController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const addresses = await listAddressesService(
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Addresses retrieved successfully.",
      addresses,
      count: addresses.length,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 3. Get Address By ID
|--------------------------------------------------------------------------
| GET /api/v1/addresses/:addressId
|--------------------------------------------------------------------------
*/

export const getAddressByIdController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const address = await getAddressByIdService(
      userId,
      req.params.addressId
    );

    return res.status(200).json({
      success: true,
      message: "Address retrieved successfully.",
      address,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 4. Update Address
|--------------------------------------------------------------------------
| PATCH /api/v1/addresses/:addressId
|--------------------------------------------------------------------------
*/

export const updateAddressController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const body = req.validatedBody ?? req.body;

    const address = await updateAddressService(
      userId,
      req.params.addressId,
      body
    );

    return res.status(200).json({
      success: true,
      message: "Address updated successfully.",
      address,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Set Default Address
|--------------------------------------------------------------------------
| PATCH /api/v1/addresses/:addressId/default
|--------------------------------------------------------------------------
*/

export const setDefaultAddressController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const address = await setDefaultAddressService(
      userId,
      req.params.addressId
    );

    return res.status(200).json({
      success: true,
      message: "Default address updated successfully.",
      address,
    });
  } catch (error) {
    return next(error);
  }
};

/*
|--------------------------------------------------------------------------
| 6. Delete Address
|--------------------------------------------------------------------------
| DELETE /api/v1/addresses/:addressId
|--------------------------------------------------------------------------
*/

export const deleteAddressController = async (
  req,
  res,
  next
) => {
  try {
    const userId = requireCustomer(req, res);

    if (!userId) {
      return;
    }

    const result = await deleteAddressService(
      userId,
      req.params.addressId
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};