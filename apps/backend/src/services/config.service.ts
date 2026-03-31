import { prisma } from '../utils/db.js';

const DEFAULT_HEADER = `FONDA CABALLO LOCO
321 914 6363
Sector Aeropuerto - Rionegro`;

const DEFAULT_FOOTER = `Por disposición de la superintendencia de
industria y comercio se informa que en este
establecimiento la propina es sugerida al 
cliente, corresponde a un porcentaje del 10% 
y es completamente voluntaria. 

Como cliente tiene el derecho a aceptar, 
modificar o rechazar dicha sugerencia. 

Si no desea cancelar dicho valor, haga caso 
omiso del mismo. Si desea cancelar un valor 
diferente, hágalo saber a la persona por la 
cual fue atendido.`;

export class ConfigService {
  // ========== PRINTERS ==========

  static async listPrinters() {
    return prisma.printer.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  static async createPrinter(data: any) {
    return prisma.printer.create({ data });
  }

  static async updatePrinter(id: string, data: any) {
    return prisma.printer.update({
      where: { id },
      data,
    });
  }

  static async deletePrinter(id: string) {
    return prisma.printer.delete({
      where: { id },
    });
  }

  // ========== PRINT SETTINGS ==========

  static async getPrintSettings() {
    let settings = await prisma.printSettings.findUnique({
      where: { id: 'singleton' },
    });

    if (!settings) {
      settings = await prisma.printSettings.create({
        data: {
          id: 'singleton',
          header: DEFAULT_HEADER,
          footer: DEFAULT_FOOTER,
          showLogo: false,
          qrText: 'Si deseas pagar desde cualquier banco o billetera virtual, usa este QR',
        },
      });
    }

    return settings;
  }

  static async updatePrintSettings(data: { header?: string; footer?: string; showLogo?: boolean; qrImage?: string | null; qrText?: string }) {
    return prisma.printSettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: {
        id: 'singleton',
        header: data.header ?? DEFAULT_HEADER,
        footer: data.footer ?? DEFAULT_FOOTER,
        showLogo: data.showLogo ?? false,
        qrImage: data.qrImage ?? null,
        qrText: data.qrText ?? 'Si deseas pagar desde cualquier banco o billetera virtual, usa este QR',
      },
    });
  }
}
