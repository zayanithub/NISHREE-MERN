import Address from "../models/Address.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (value) => {
  return (
    typeof value === "string" &&
    /^[a-f\d]{24}$/i.test(value)
  );
};

const validateObjectId = (value, fieldName) => {
  if (!isValidObjectId(String(value ?? ""))) {
    throw createError(
      `Invalid ${fieldName}.`,
      400
    );
  }

  return String(value);
};

const validateUserId = (userId) => {
  if (!isValidObjectId(String(userId ?? ""))) {
    throw createError(
      "Valid customer authentication is required.",
      401
    );
  }

  return String(userId);
};

/*
|--------------------------------------------------------------------------
| Error Handler
|--------------------------------------------------------------------------
*/

const handleAddressError = (error) => {
  if (error.statusCode) {
    throw error;
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    throw createError(
      error.message,
      400
    );
  }

  throw error;
};

/*
|--------------------------------------------------------------------------
| Address Input Validation
|--------------------------------------------------------------------------
*/

const allowedCreateFields = new Set([
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "landmark",
  "city",
  "state",
  "postalCode",
  "country",
  "addressType",
  "addressFor",
  "isDefault",
]);

const allowedUpdateFields = new Set([
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "landmark",
  "city",
  "state",
  "postalCode",
  "country",
  "addressType",
  "addressFor",
]);

const requiredAddressFields = [
  "fullName",
  "phone",
  "addressLine1",
  "city",
  "state",
  "postalCode",
];

const stringFieldRules = {
  fullName: {
    maxLength: 100,
    label: "Full name",
  },
  addressLine1: {
    maxLength: 200,
    label: "Address line 1",
  },
  addressLine2: {
    maxLength: 200,
    label: "Address line 2",
  },
  landmark: {
    maxLength: 150,
    label: "Landmark",
  },
  city: {
    maxLength: 100,
    label: "City",
  },
  state: {
    maxLength: 100,
    label: "State",
  },
  country: {
    maxLength: 100,
    label: "Country",
  },
};

/*
|--------------------------------------------------------------------------
| Phone Validation
|--------------------------------------------------------------------------
|
| Accepts 10–15 digit international phone numbers.
| Spaces, brackets and hyphens are removed.
|--------------------------------------------------------------------------
*/

const normalizePhone = (value) => {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw createError(
      "Phone number is required.",
      400
    );
  }

  const phone = value
    .trim()
    .replace(/[\s()-]/g, "");

  if (!/^\+?[1-9]\d{9,14}$/.test(phone)) {
    throw createError(
      "Enter a valid phone number with 10 to 15 digits.",
      400
    );
  }

  return phone;
};

/*
|--------------------------------------------------------------------------
| Postal Code Validation
|--------------------------------------------------------------------------
*/

const validatePostalCode = (
  postalCode,
  country
) => {
  if (
    typeof postalCode !== "string" ||
    !postalCode.trim()
  ) {
    throw createError(
      "Postal code is required.",
      400
    );
  }

  const normalizedPostalCode =
    postalCode.trim();

  if (
    country.toLowerCase() === "india" &&
    !/^\d{6}$/.test(normalizedPostalCode)
  ) {
    throw createError(
      "Indian postal code must contain exactly 6 digits.",
      400
    );
  }

  if (
    country.toLowerCase() !== "india" &&
    !/^[a-zA-Z0-9][a-zA-Z0-9 -]{1,11}$/.test(
      normalizedPostalCode
    )
  ) {
    throw createError(
      "Enter a valid postal code.",
      400
    );
  }

  return normalizedPostalCode;
};

/*
|--------------------------------------------------------------------------
| Normalize And Validate Address Payload
|--------------------------------------------------------------------------
|
| Only explicitly supported fields are accepted.
| Customer ID is assigned by the service, never by the request body.
|--------------------------------------------------------------------------
*/

const normalizeAddressPayload = (
  data,
  {
    partial = false,
    allowDefault = false,
    currentAddress = null,
  } = {}
) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw createError(
      "Address data must be a valid object.",
      400
    );
  }

  const allowedFields = allowDefault
    ? allowedCreateFields
    : allowedUpdateFields;

  const unknownFields = Object.keys(data).filter(
    (key) => !allowedFields.has(key)
  );

  if (unknownFields.length > 0) {
    throw createError(
      `Unsupported address field(s): ${unknownFields.join(", ")}.`,
      400
    );
  }

  if (Object.keys(data).length === 0) {
    throw createError(
      "At least one address field is required.",
      400
    );
  }

  if (!partial) {
    for (const field of requiredAddressFields) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        (
          typeof data[field] === "string" &&
          !data[field].trim()
        )
      ) {
        throw createError(
          `${field} is required.`,
          400
        );
      }
    }
  }

  const normalized = {};

  /*
   * Normalize known string fields and enforce their
   * maximum lengths.
   */
  for (const [field, rule] of Object.entries(
    stringFieldRules
  )) {
    const supplied = Object.prototype.hasOwnProperty.call(
      data,
      field
    );

    if (!supplied && partial) {
      continue;
    }

    let value = supplied
      ? data[field]
      : undefined;

    if (
      value === undefined &&
      field === "country" &&
      !partial
    ) {
      value = "India";
    }

    if (
      value === undefined &&
      !partial &&
      [
        "addressLine2",
        "landmark",
      ].includes(field)
    ) {
      value = "";
    }

    if (value === undefined && partial) {
      continue;
    }

    if (typeof value !== "string") {
      throw createError(
        `${rule.label} must be a string.`,
        400
      );
    }

    value = value.trim();

    if (value.length > rule.maxLength) {
      throw createError(
        `${rule.label} cannot exceed ${rule.maxLength} characters.`,
        400
      );
    }

    if (
      !partial &&
      requiredAddressFields.includes(field) &&
      !value
    ) {
      throw createError(
        `${rule.label} is required.`,
        400
      );
    }

    if (
      partial &&
      requiredAddressFields.includes(field) &&
      !value
    ) {
      throw createError(
        `${rule.label} cannot be empty.`,
        400
      );
    }

    normalized[field] = value;
  }

  /*
   * Phone number
   */
  if (
    Object.prototype.hasOwnProperty.call(
      data,
      "phone"
    ) ||
    !partial
  ) {
    normalized.phone = normalizePhone(
      data.phone
    );
  }

  /*
   * Address type
   */
  if (
    Object.prototype.hasOwnProperty.call(
      data,
      "addressType"
    ) ||
    !partial
  ) {
    const addressType =
      data.addressType ?? "home";

    if (
      !["home", "work", "other"].includes(
        addressType
      )
    ) {
      throw createError(
        "Address type must be home, work, or other.",
        400
      );
    }

    normalized.addressType = addressType;
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "addressFor") ||
    !partial
  ) {
    const addressFor = data.addressFor ?? "both";
    if (!["shipping", "billing", "both"].includes(addressFor)) {
      throw createError(
        "Address use must be shipping, billing, or both.",
        400
      );
    }
    normalized.addressFor = addressFor;
  }

  /*
   * Country and postal code must be validated together.
   */
  const resultingCountry =
    normalized.country ??
    currentAddress?.country ??
    "India";

  const suppliedPostalCode =
    Object.prototype.hasOwnProperty.call(
      data,
      "postalCode"
    );

  const countryChanged =
    Object.prototype.hasOwnProperty.call(
      data,
      "country"
    ) &&
    normalized.country !== currentAddress?.country;

  if (
    suppliedPostalCode ||
    !partial ||
    countryChanged
  ) {
    const postalCode = suppliedPostalCode
      ? data.postalCode
      : currentAddress?.postalCode;

    normalized.postalCode = validatePostalCode(
      postalCode,
      resultingCountry
    );
  }

  /*
   * isDefault is accepted only during creation.
   * Existing defaults are changed via setDefaultAddress().
   */
  if (allowDefault) {
    if (
      data.isDefault !== undefined &&
      typeof data.isDefault !== "boolean"
    ) {
      throw createError(
        "isDefault must be true or false.",
        400
      );
    }

    normalized.isDefault =
      data.isDefault ?? false;
  }

  return normalized;
};

/*
|--------------------------------------------------------------------------
| 1. Create Address
|--------------------------------------------------------------------------
| The first address automatically becomes the default.
|--------------------------------------------------------------------------
*/

export const createAddress = async (
  userId,
  data
) => {
  const validatedUserId =
    validateUserId(userId);

  try {
    const payload = normalizeAddressPayload(
      data,
      {
        partial: false,
        allowDefault: true,
      }
    );

    const hasShippingAddress = payload.addressFor !== "billing"
      ? await Address.exists({
          user: validatedUserId,
          addressFor: { $ne: "billing" },
        })
      : true;

    const shouldBeDefault =
      payload.addressFor !== "billing" &&
      (payload.isDefault === true || !hasShippingAddress);

    /*
     * Create the new record as non-default first.
     * Change the default only after the new record exists.
     */
    const address = await Address.create({
      ...payload,
      user: validatedUserId,
      isDefault: false,
    });

    if (shouldBeDefault) {
      await Address.updateMany(
        {
          user: validatedUserId,
          _id: { $ne: address._id },
          addressFor: { $ne: "billing" },
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );

      await Address.updateOne(
        {
          _id: address._id,
          user: validatedUserId,
        },
        {
          $set: {
            isDefault: true,
          },
        }
      );
    }

    return await Address.findOne({
      _id: address._id,
      user: validatedUserId,
    }).lean();
  } catch (error) {
    handleAddressError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Customer Addresses
|--------------------------------------------------------------------------
| Default address appears first.
|--------------------------------------------------------------------------
*/

export const listAddresses = async (userId) => {
  const validatedUserId =
    validateUserId(userId);

  return Address.find({
    user: validatedUserId,
  })
    .sort({
      isDefault: -1,
      updatedAt: -1,
      _id: 1,
    })
    .lean();
};

/*
|--------------------------------------------------------------------------
| 3. Get Address By ID
|--------------------------------------------------------------------------
| Customer ownership is enforced in the database query.
|--------------------------------------------------------------------------
*/

export const getAddressById = async (
  userId,
  addressId
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedAddressId =
    validateObjectId(
      addressId,
      "address ID"
    );

  const address = await Address.findOne({
    _id: validatedAddressId,
    user: validatedUserId,
  }).lean();

  if (!address) {
    throw createError(
      "Address not found.",
      404
    );
  }

  return address;
};

/*
|--------------------------------------------------------------------------
| 4. Update Address
|--------------------------------------------------------------------------
|
| Ownership is checked before modification.
| Default-address status must be changed through
| setDefaultAddress().
|--------------------------------------------------------------------------
*/

export const updateAddress = async (
  userId,
  addressId,
  data
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedAddressId =
    validateObjectId(
      addressId,
      "address ID"
    );

  try {
    const address = await Address.findOne({
      _id: validatedAddressId,
      user: validatedUserId,
    });

    if (!address) {
      throw createError(
        "Address not found.",
        404
      );
    }

    const payload = normalizeAddressPayload(
      data,
      {
        partial: true,
        currentAddress: address,
      }
    );

    const wasDefault = address.isDefault;
    Object.assign(address, payload);
    if (address.addressFor === "billing") {
      address.isDefault = false;
    }

    await address.save();

    if (wasDefault && address.addressFor === "billing") {
      const replacementDefault = await Address.findOne({
        user: validatedUserId,
        _id: { $ne: address._id },
        addressFor: { $ne: "billing" },
      }).sort({ updatedAt: -1, _id: 1 });
      if (replacementDefault) {
        await Address.updateMany(
          {
            user: validatedUserId,
            _id: { $ne: replacementDefault._id },
            addressFor: { $ne: "billing" },
            isDefault: true,
          },
          { $set: { isDefault: false } }
        );
        await Address.updateOne(
          { _id: replacementDefault._id, user: validatedUserId },
          { $set: { isDefault: true } }
        );
      }
    }
    if (address.addressFor !== "billing" && !address.isDefault) {
      const hasDefaultShippingAddress = await Address.exists({
        user: validatedUserId,
        _id: { $ne: address._id },
        addressFor: { $ne: "billing" },
        isDefault: true,
      });
      if (!hasDefaultShippingAddress) {
        address.isDefault = true;
        await address.save();
      }
    }

    return await Address.findOne({
      _id: address._id,
      user: validatedUserId,
    }).lean();
  } catch (error) {
    handleAddressError(error);
  }
};

/*
|--------------------------------------------------------------------------
| 5. Set Default Address
|--------------------------------------------------------------------------
|
| Clears the previous default for this customer,
| then marks the selected address as default.
|--------------------------------------------------------------------------
*/

export const setDefaultAddress = async (
  userId,
  addressId
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedAddressId =
    validateObjectId(
      addressId,
      "address ID"
    );

  const address = await Address.findOne({
    _id: validatedAddressId,
    user: validatedUserId,
  });

  if (!address) {
    throw createError(
      "Address not found.",
      404
    );
  }

  if (address.addressFor === "billing") {
    throw createError(
      "A billing-only address cannot be the default shipping address.",
      400
    );
  }

  await Address.updateMany(
    {
      user: validatedUserId,
      _id: { $ne: validatedAddressId },
      addressFor: { $ne: "billing" },
      isDefault: true,
    },
    {
      $set: {
        isDefault: false,
      },
    }
  );

  await Address.updateOne(
    {
      _id: validatedAddressId,
      user: validatedUserId,
    },
    {
      $set: {
        isDefault: true,
      },
    }
  );

  return Address.findOne({
    _id: validatedAddressId,
    user: validatedUserId,
  }).lean();
};

/*
|--------------------------------------------------------------------------
| 6. Delete Address
|--------------------------------------------------------------------------
|
| If the deleted address was the default, the oldest
| remaining address automatically becomes the default.
|--------------------------------------------------------------------------
*/

export const deleteAddress = async (
  userId,
  addressId
) => {
  const validatedUserId =
    validateUserId(userId);

  const validatedAddressId =
    validateObjectId(
      addressId,
      "address ID"
    );

  const address = await Address.findOne({
    _id: validatedAddressId,
    user: validatedUserId,
  });

  if (!address) {
    throw createError(
      "Address not found.",
      404
    );
  }

  const wasDefault = address.isDefault;

  await Address.deleteOne({
    _id: validatedAddressId,
    user: validatedUserId,
  });

  let promotedAddress = null;

  if (wasDefault) {
    promotedAddress = await Address.findOne({
      user: validatedUserId,
      addressFor: { $ne: "billing" },
    })
      .sort({
        createdAt: 1,
        _id: 1,
      });

    if (promotedAddress) {
      await Address.updateMany(
        {
          user: validatedUserId,
          _id: { $ne: promotedAddress._id },
          addressFor: { $ne: "billing" },
          isDefault: true,
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );

      await Address.updateOne(
        {
          _id: promotedAddress._id,
          user: validatedUserId,
        },
        {
          $set: {
            isDefault: true,
          },
        }
      );
    }
  }

  return {
    id: validatedAddressId,
    message: "Address deleted successfully.",
    defaultAddressPromoted: Boolean(
      promotedAddress
    ),
  };
};