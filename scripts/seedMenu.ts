import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(fs.readFileSync('menu_seed.json', 'utf-8'));

  // Delete all existing menu items
  await prisma.menu_items.deleteMany();

  // Insert new menu items
  for (const item of data.menu_items) {
    await prisma.menu_items.create({
      data: {
        id: uuidv4(),
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        image_url: item.image_url,
        is_best_seller: item.is_best_seller,
        is_new: item.is_new,
        available: item.available,
      },
    });
  }

  console.log('Menu items replaced successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
