CREATE SCHEMA mc;

CREATE TABLE mc.Users (
    userId INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(MAX) NULL,
    token VARCHAR(MAX) NULL
)

CREATE TABLE mc.itemTypes (
    itemTypeId INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
)

INSERT INTO mc.ItemTypes (name)
SELECT 'Points Group'

CREATE TABLE mc.itemPermissionTypes (
    itemPermissionTypeId INT NOT NULL IDENTITY(1, 1) PRIMARY KEY,
    description VARCHAR(100) NOT NULL
)

INSERT INTO mc.itemPermissionTypes
SELECT 'Private' AS description UNION
SELECT 'Public' AS description

CREATE TABLE mc.items (
    itemId INT NOT NULL IDENTITY(1,1) PRIMARY KEY,
    itemTypeId INT NOT NULL FOREIGN KEY REFERENCES mc.itemTypes(itemTypeId),
    itemPermissionTypeId INT NOT NULL FOREIGN KEY REFERENCES mc.itemPermissionTypes(itemPermissionTypeId),
    dateCreated DATETIME NOT NULL DEFAULT GETDATE(),
    dateDeleted DATETIME NULL
)

CREATE TABLE mc.userItems (
    userId INT NOT NULL FOREIGN KEY REFERENCES mc.users(userId),
    itemId iNT NOT NULL FOREIGN KEY REFERENCES mc.items(itemId)
)

CREATE TABLE mc.userFavorites (
    userId iNT NOT NULL FOREIGN KEY REFERENCES mc.users(userId),
    itemId INT NOT NULL FOREIGN KEY REFERENCES mc.items(itemId)
)



