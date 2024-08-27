import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  /* eg:
   *
   * If want to seed the type maybe or all default seed. if want to alternative other than csv. it could multiple schema db too,
   * so could pull from backend db/ file then parse to the live one.. or could for example up from dev-live sync all type.
   *
   */
  // const channelName = ["JKRT", "BND", "YK", "BALI", "TGR"]; // unique
  // const already = await prisma.channel.count({
  //   where: {
  //     name: {
  //       in: channelName,
  //     },
  //   },
  // });
  //
  // if (already === channelName.length) {
  //   console.info("Already populate");
  // } else {
  //   const table = await prisma.channel.createMany({
  //     data: channelName.map((name) => ({ name })),
  //   });
  //
  //   console.log({ channel });
  // }
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
