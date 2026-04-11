import { prisma } from '../utils/db.js';

export class TableService {
  static async getRooms() {
    return prisma.room.findMany({
      include: {
        tables: {
          include: {
            activeSale: {
              include: {
                items: { include: { product: true } },
                user: { select: { username: true } }
              }
            }
          }
        },
      },
    });
  }

  static async getRoomById(id: string) {
    return prisma.room.findUnique({
      where: { id },
      include: {
        tables: true,
      },
    });
  }

  static async updateTableStatus(tableId: string, status: string, openingComment?: string, userId?: string) {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { activeSale: true }
    });

    if (status === 'OCCUPIED' && userId) {
      if (!table?.activeSale) {
        // Create a sale when opening a table for the first time
        await prisma.sale.create({
          data: {
            tableId,
            userId,
            openingComment,
            status: 'OPEN'
          }
        });
      } else if (openingComment !== undefined) {
        // Update existing sale's comment
        await prisma.sale.update({
          where: { id: table.activeSale.id },
          data: { openingComment }
        });
      }
    }

    if (status === 'FREE') {
      // Detach all sales from this table and mark any open ones as closed
      await prisma.sale.updateMany({
        where: { tableId, status: 'OPEN' },
        data: { status: 'CLOSED', tableId: null, closedAt: new Date() }
      });
    }

    return prisma.table.update({
      where: { id: tableId },
      data: { status },
      include: {
        activeSale: {
          include: { items: { include: { product: true } }, user: { select: { username: true } } }
        }
      }
    });
  }

  static async checkoutTable(tableId: string, paymentMethod: string, amountPaid: number, tipAmount: number = 0) {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { activeSale: true }
    });

    if (table?.activeSale) {
      await prisma.payment.create({
        data: {
          saleId: table.activeSale.id,
          method: paymentMethod,
          amount: amountPaid,
          tip: tipAmount
        }
      });

      await prisma.sale.update({
        where: { id: table.activeSale.id },
        data: { 
          status: 'CLOSED', 
          tableId: null, 
          tableName: table.number.toString(),
          closedAt: new Date() 
        }
      });
    }

    return prisma.table.update({
      where: { id: tableId },
      data: { status: 'FREE' },
      include: {
        activeSale: {
          include: { items: { include: { product: true } }, user: { select: { username: true } } }
        }
      }
    });
  }

  static async addItemsToSale(saleId: string, items: { productId: string, quantity: number, price: number, comment?: string }[]) {
    return prisma.sale.update({
      where: { id: saleId },
      data: {
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            comment: item.comment,
            confirmed: true
          }))
        },
        // Update subtotal/total
        total: { increment: items.reduce((acc, item) => acc + (item.price * item.quantity), 0) },
        subtotal: { increment: items.reduce((acc, item) => acc + (item.price * item.quantity), 0) }
      },
      include: { items: { include: { product: true } }, user: { select: { username: true } } }
    });
  }

  static async applyDiscount(tableId: string, discount: number) {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { activeSale: true }
    });

    if (!table?.activeSale) {
      throw new Error('La mesa no tiene una cuenta activa');
    }

    const newTotal = Math.max(0, table.activeSale.subtotal - discount);

    await prisma.sale.update({
      where: { id: table.activeSale.id },
      data: {
        discount,
        total: newTotal
      }
    });

    return prisma.table.findUnique({
      where: { id: tableId },
      include: {
        activeSale: {
          include: { items: { include: { product: true } }, user: { select: { username: true } } }
        }
      }
    });
  }

  static async partialCheckout(
    tableId: string,
    items: { saleItemId: string; qty: number }[],
    paymentMethod: string,
    amountPaid: number,
    tipAmount: number = 0
  ) {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { activeSale: { include: { items: true } } }
    });

    if (!table?.activeSale) {
      throw new Error('La mesa no tiene una cuenta activa');
    }

    // Validate and calculate partial total
    let partialSubtotal = 0;
    for (const partialItem of items) {
      if (partialItem.qty <= 0) continue;

      const saleItem = table.activeSale.items.find(i => i.id === partialItem.saleItemId);
      if (!saleItem) {
        throw new Error(`Producto no encontrado: ${partialItem.saleItemId}`);
      }

      const remaining = saleItem.quantity - saleItem.paidQty;
      if (partialItem.qty > remaining + 0.01) {
        throw new Error(`Cantidad excede lo pendiente para ${saleItem.id}`);
      }

      partialSubtotal += saleItem.price * partialItem.qty;
    }

    if (partialSubtotal <= 0) {
      throw new Error('Selecciona al menos un producto para el cierre parcial');
    }

    // Update paidQty for each item
    for (const partialItem of items) {
      if (partialItem.qty <= 0) continue;

      const saleItem = table.activeSale.items.find(i => i.id === partialItem.saleItemId)!;
      await prisma.saleItem.update({
        where: { id: partialItem.saleItemId },
        data: {
          paidQty: saleItem.paidQty + partialItem.qty
        }
      });
    }

    // Create payment for this partial checkout
    await prisma.payment.create({
      data: {
        saleId: table.activeSale.id,
        method: paymentMethod,
        amount: amountPaid,
        tip: tipAmount
      }
    });

    // Return refreshed table
    return prisma.table.findUnique({
      where: { id: tableId },
      include: {
        activeSale: {
          include: { items: { include: { product: true } }, user: { select: { username: true } } }
        }
      }
    });
  }

  static async getTablesByRoom(roomId: string) {
    return prisma.table.findMany({
      where: { roomId },
    });
  }

  static async updateTableCoordinates(tableId: string, x: number, y: number) {
    return prisma.table.update({
      where: { id: tableId },
      data: { x, y },
      include: {
        activeSale: {
          include: {
            items: {
              include: {
                product: true
              }
            },
            user: { select: { username: true } }
          }
        }
      }
    });
  }

  static async updateTableShape(tableId: string, shape: string) {
    return prisma.table.update({
      where: { id: tableId },
      data: { shape },
      include: {
        activeSale: {
          include: {
            items: {
              include: {
                product: true
              }
            },
            user: { select: { username: true } }
          }
        }
      }
    });
  }

  static async updateTableSize(tableId: string, size: string) {
    return prisma.table.update({
      where: { id: tableId },
      data: { size },
      include: {
        activeSale: {
          include: {
            items: {
              include: {
                product: true
              }
            },
            user: { select: { username: true } }
          }
        }
      }
    });
  }

  static async createTable(data: { number: number; x: number; y: number; shape: string; size: string; roomId: string; status: string }) {
    // Prevent duplicate table numbers by ensuring the number is unique
    let finalNumber = data.number;
    const existingTable = await prisma.table.findFirst({
      where: { number: finalNumber }
    });

    if (existingTable) {
      // Find the first available numeric gap in the global sequence (1, 2, 3...)
      const allTables = await prisma.table.findMany({
        select: { number: true },
        orderBy: { number: 'asc' }
      });
      const numbers = allTables.map(t => t.number);
      let missingNumber = 1;
      for (const num of numbers) {
        if (num === missingNumber) missingNumber++;
        else if (num > missingNumber) break;
      }
      finalNumber = missingNumber;
    }

    return prisma.table.create({
      data: {
        ...data,
        number: finalNumber
      },
      include: {
        activeSale: {
          include: {
            items: {
              include: {
                product: true
              }
            },
            user: { select: { username: true } }
          }
        }
      }
    });
  }
  static async deleteTable(tableId: string) {
    // Safely detach any sales (active or closed) from this table before deletion
    // to prevent foreign key constraint violations.
    await prisma.sale.updateMany({
      where: { tableId },
      data: { tableId: null }
    });

    return prisma.table.delete({
      where: { id: tableId }
    });
  }

  static async createRoom(name: string) {
    return prisma.room.create({
      data: { name }
    });
  }

  static async updateRoom(id: string, name: string) {
    return prisma.room.update({
      where: { id },
      data: { name }
    });
  }

  static async deleteRoom(id: string) {
    // First, delete all tables in the room to avoid foreign key issues
    const tables = await prisma.table.findMany({
      where: { roomId: id }
    });

    for (const table of tables) {
      await this.deleteTable(table.id);
    }

    return prisma.room.delete({
      where: { id }
    });
  }

  static async updateRoomZoom(id: string, zoom: number) {
    return prisma.room.update({
      where: { id },
      data: { zoom }
    });
  }

  static async deleteSaleItem(itemId: string) {
    const item = await prisma.saleItem.findUnique({
      where: { id: itemId }
    });

    if (!item) throw new Error('Item no encontrado');

    const amount = item.price * item.quantity;

    await prisma.saleItem.delete({
      where: { id: itemId }
    });

    // Update sale totals
    return prisma.sale.update({
      where: { id: item.saleId },
      data: {
        subtotal: { decrement: amount },
        total: { decrement: amount }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
  }

  /**
   * Move an entire sale from one table to another.
   * If the target table has an active sale, merge items into it.
   */
  static async moveSale(fromTableId: string, toTableId: string) {
    const fromTable = await prisma.table.findUnique({
      where: { id: fromTableId },
      include: { activeSale: { include: { items: true } } }
    });

    if (!fromTable?.activeSale) throw new Error('La mesa origen no tiene una venta activa');

    const toTable = await prisma.table.findUnique({
      where: { id: toTableId },
      include: { activeSale: true }
    });

    if (!toTable) throw new Error('Mesa destino no encontrada');

    if (toTable.activeSale) {
      // MERGE: move all items from source sale into target sale
      const itemsAmount = fromTable.activeSale.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

      await prisma.saleItem.updateMany({
        where: { saleId: fromTable.activeSale.id },
        data: { saleId: toTable.activeSale.id }
      });

      // Update target sale totals
      await prisma.sale.update({
        where: { id: toTable.activeSale.id },
        data: {
          subtotal: { increment: itemsAmount },
          total: { increment: itemsAmount }
        }
      });

      // Delete the now-empty source sale
      await prisma.sale.delete({
        where: { id: fromTable.activeSale.id }
      });
    } else {
      // Simple move: reassign sale to new table
      await prisma.sale.update({
        where: { id: fromTable.activeSale.id },
        data: { tableId: toTableId }
      });

      await prisma.table.update({
        where: { id: toTableId },
        data: { status: 'OCCUPIED' }
      });
    }

    // Free the source table
    await prisma.table.update({
      where: { id: fromTableId },
      data: { status: 'FREE' }
    });

    // Return both tables refreshed
    const include = { activeSale: { include: { items: { include: { product: true } }, user: { select: { username: true } } } } };
    const updatedFrom = await prisma.table.findUnique({ where: { id: fromTableId }, include });
    const updatedTo = await prisma.table.findUnique({ where: { id: toTableId }, include });

    return { from: updatedFrom, to: updatedTo };
  }

  /**
   * Split selected items from a sale to a new sale on another table.
   */
  static async splitSale(fromTableId: string, toTableId: string, itemIds: string[]) {
    const fromTable = await prisma.table.findUnique({
      where: { id: fromTableId },
      include: { activeSale: { include: { items: true } } }
    });

    if (!fromTable?.activeSale) throw new Error('La mesa origen no tiene una venta activa');
    if (itemIds.length === 0) throw new Error('Debes seleccionar al menos un producto');

    const toTable = await prisma.table.findUnique({
      where: { id: toTableId },
      include: { activeSale: true }
    });

    if (!toTable) throw new Error('Mesa destino no encontrada');
    if (toTable.activeSale) throw new Error('La mesa destino ya tiene una venta activa');

    // Validate all items belong to the sale
    const saleItems = fromTable.activeSale.items;
    const itemsToMove = saleItems.filter(i => itemIds.includes(i.id));
    if (itemsToMove.length !== itemIds.length) throw new Error('Algunos productos no pertenecen a esta venta');

    // Ensure we're not moving ALL items (use Mover Venta for that)
    if (itemsToMove.length === saleItems.length) throw new Error('No puedes separar todos los productos. Usa "Mover Venta" en su lugar.');

    const amountToMove = itemsToMove.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // Create new sale on target table
    const newSale = await prisma.sale.create({
      data: {
        tableId: toTableId,
        userId: fromTable.activeSale.userId,
        status: 'OPEN',
        subtotal: amountToMove,
        total: amountToMove,
      }
    });

    // Move items to new sale
    await prisma.saleItem.updateMany({
      where: { id: { in: itemIds } },
      data: { saleId: newSale.id }
    });

    // Update original sale totals
    await prisma.sale.update({
      where: { id: fromTable.activeSale.id },
      data: {
        subtotal: { decrement: amountToMove },
        total: { decrement: amountToMove }
      }
    });

    // Mark target table as occupied
    await prisma.table.update({
      where: { id: toTableId },
      data: { status: 'OCCUPIED' }
    });

    // Return both tables
    const include = { activeSale: { include: { items: { include: { product: true } }, user: { select: { username: true } } } } };
    const updatedFrom = await prisma.table.findUnique({ where: { id: fromTableId }, include });
    const updatedTo = await prisma.table.findUnique({ where: { id: toTableId }, include });

    return { from: updatedFrom, to: updatedTo };
  }
}

