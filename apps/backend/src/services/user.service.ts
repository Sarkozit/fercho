import bcrypt from 'bcrypt';
import { prisma } from '../utils/db.js';

export class UserService {
  static async createUser(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        active: data.active ?? true,
      },
    });
  }

  static async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async listUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async updateUser(id: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    return prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        lastLogin: true,
        createdAt: true,
      },
    });
  }

  static async deleteUser(id: string) {
    return prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }
}
