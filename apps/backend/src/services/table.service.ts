import { prisma } from '../utils/db.js';

export class TableService {
  static async getRooms() {
    return prisma.room.findMany({
      include: {
        tables: {
          include: {
            activeSale: {
              include: {
                items: { include: { product: true } }
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
          include: { items: { include: { product: true } } }
        }
      }
    });
  }

  static async checkoutTable(tableId: string, paymentMethod: string, amountPaid: number) {
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { activeSale: true }
    });

    if (table?.activeSale) {
      await prisma.payment.create({
        data: {
          saleId: table.activeSale.id,
          method: paymentMethod,
          amount: amountPaid
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
          include: { items: { include: { product: true } } }
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
      include: { items: { include: { product: true } } }
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
            }
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
            }
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
            }
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
            }
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
}
