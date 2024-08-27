import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Z_SalaryDriverList } from "@zodSchema/salary/zDriverSchema";
import dayjs from "dayjs";
import { Request, Response } from "express";
import { isSearch } from "utils/isSearch";
// import { z } from "zod";

// c_list ? = everthing just to get the list will put here;
// eg:
// - list salary driver
// - list salary non driver
// - list salary all for report
// - list salary unpaid

// ======= Global Vars =====

// why ? easy to adjust when need; also make ez to others to use, minimize human error when dealing with strings;
// vars name `status` first so when our friends hit status the linter will suggest others `status_[any]` make it easy n fast to work with(appling same with db naming?).
const STATUS_COST = {
  PENDING: "PENDING", // could 0,
  CONFIRMED: "CONFIRMED", // could 1,
  PAID: "PAID", // or 1a79a4d60 (alien language or old system language that only god know. this make it easy)
};

const STATUS_SHIPMENT = {
  CANCELLED: "CANCELLED",
  RUNNING: "RUNNING",
  DONE: "DONE",
};

const KEY_DRIVER_MONTHLY_ATTENDANCE_SALARY = "DRIVER_MONTHLY_ATTENDANCE_SALARY";

// ======= Controller Function(capital letter first) =====

export const HandleGetSalaryDriverList = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = Z_SalaryDriverList.parse(req.body);
    /* or (for below approach is fast but for bundling not good, cause variable could be reused;) */
    // const input = z.object({
    //   search: z.string().optional(),
    //   date: z.string(),
    //   date_to: z.string().optional().nullable(),
    //   driver_code: z.string().optional().nullable(),
    //   filters: z
    //     .object({
    //       status: z
    //         .enum(["PENDING", "CONFIRMED", "PAID"])
    //         .optional()
    //         .nullable(),
    //     })
    //     .optional()
    //     .nullable(),
    //   pagination: z.object({
    //     take: z.number(),
    //     skip: z.number(),
    //   }),
    // });

    const search = isSearch(input.search);
    const start = dayjs(input.date).startOf("month").toISOString();
    const end = dayjs(!!input?.date_to ? input.date_to : input.date)
      .endOf("month")
      .toISOString();

    const filters_shipment_cost: {
      [key in keyof typeof STATUS_COST]: Prisma.driversWhereInput;
    } = {
      PENDING: {
        shipment_costs: {
          some: {
            total_costs: {
              gt: 0,
            },
            cost_status: STATUS_COST.PENDING,
          },
        },
      },
      CONFIRMED: {
        shipment_costs: {
          some: {
            total_costs: {
              gt: 0,
            },
            cost_status: STATUS_COST.CONFIRMED,
          },
        },
      },
      PAID: {
        AND: [
          {
            shipment_costs: {
              some: {
                total_costs: {
                  gt: 0,
                },
                cost_status: STATUS_COST.PAID,
              },
            },
          },
          {
            shipment_costs: {
              every: {
                total_costs: {
                  lte: 0,
                },
                cost_status: STATUS_COST.CONFIRMED,
              },
            },
          },
          {
            shipment_costs: {
              every: {
                total_costs: {
                  lte: 0,
                },
                cost_status: STATUS_COST.PENDING,
              },
            },
          },
        ],
      },
    };

    const where: Prisma.driversWhereInput = {
      shipment_costs: {
        some: {
          shipments: {
            shipment_date: {
              gte: start,
              lte: end,
            },
          },
        },
      },
      AND: {
        ...(filters_shipment_cost?.[input?.filters?.status!] ?? {}),
        OR: search.isValid
          ? [
              {
                driver_code: {
                  contains: search.text,
                },
              },
              {
                driver_code: {
                  contains: search.text,
                },
              },
              search.isNumber
                ? {
                    shipment_costs: {
                      some: {
                        total_costs: search.number,
                      },
                    },
                  }
                : {},
            ]
          : [],
      },
    };

    const dataRaw =
      (await req.prisma?.drivers.findMany({
        where,
        take: input.pagination.take,
        skip: input.pagination.skip,
      })) ?? [];

    const total = (await req.prisma?.drivers.count({ where })) ?? 0;

    const id_drivers = dataRaw.map((d) => d.id);
    const totalShipmentCost = await getTotalShipmentCost(
      req,
      id_drivers,
      start,
      end,
    ).then(
      (item) =>
        new Map(
          item.map(({ id_drivers, cost_total, ...rest }) => [
            id_drivers,
            { rest, cost_total },
          ]),
        ),
    ); // dont use [array].find performance issue, well it could just use raw query instead actually, but hard to scale and adjust sometimes cause ppl often have their own approach in raw query makes it difficult(sometimes).

    const totalShipment = await getTotalShipment(
      req,
      id_drivers,
      start,
      end,
    ).then(
      (item) =>
        new Map(
          item.map(({ driver_code, count_shipment }) => [
            driver_code,
            { count_shipment },
          ]),
        ),
    );

    const total_attendance_salary = await getTotalAttendanceSalary(
      req,
      id_drivers,
      start,
      end,
    ).then((d) => new Map(d));

    const data = dataRaw.map(({ id, driver_code, name }) => {
      let shipmentCost = totalShipmentCost.get(id);
      const total_shipmentCost = !!shipmentCost
        ? shipmentCost.cost_total
        : new Decimal(0);

      return {
        driver_code,
        name,
        total_salary: total_shipmentCost.plus(
          new Decimal(total_attendance_salary.get(driver_code) ?? 0),
        ),
        ...shipmentCost?.rest,
        ...totalShipment.get(driver_code),
      };
    });

    return res.status(200).json({
      data,
      total,
    });
  } catch (err) {
    // return defaultErrorHandling(req, res, err)
  }
};

// ======= Helper Function(lower case first) =====

export const getTotalShipmentCost = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
  const shipment_cost: {
    id_drivers: number;
    cost_pending: Decimal;
    cost_confirm: Decimal;
    cost_paid: Decimal;
    cost_total: Decimal;
  }[] = [];

  const defaultDecimal = new Decimal(0);
  const WhereConditionAnd: Prisma.shipment_costsWhereInput["AND"] = [
    {
      shipments: {
        shipment_status: {
          not: STATUS_SHIPMENT.CANCELLED,
        },
        shipment_date: {
          gte: start,
          lte: end,
        },
      },
    },
    //... add more condition
  ];

  for await (const id of id_drivers) {
    const cost_pending =
      (await req.prisma?.shipment_costs
        .aggregate({
          where: {
            drivers: { id },
            cost_status: STATUS_COST.PENDING,
            AND: WhereConditionAnd,
          },
          _sum: {
            total_costs: true,
          },
        })
        .then((d) => d?._sum?.total_costs ?? defaultDecimal)) ?? defaultDecimal;

    const cost_confirm =
      (await req.prisma?.shipment_costs
        .aggregate({
          where: {
            drivers: { id },
            cost_status: STATUS_COST.CONFIRMED,
            AND: WhereConditionAnd,
          },
          _sum: {
            total_costs: true,
          },
        })
        .then((d) => d._sum.total_costs ?? defaultDecimal)) ?? defaultDecimal;

    const cost_paid =
      (await req.prisma?.shipment_costs
        .aggregate({
          where: {
            drivers: { id },
            cost_status: STATUS_COST.PAID,
            AND: WhereConditionAnd,
          },
          _sum: {
            total_costs: true,
          },
        })
        .then((d) => d._sum.total_costs ?? defaultDecimal)) ?? defaultDecimal;

    shipment_cost.push({
      id_drivers: id,
      cost_pending,
      cost_confirm,
      cost_paid,
      cost_total: cost_pending.plus(cost_confirm).plus(cost_paid),
    });
  }

  return shipment_cost;
};

const getTotalShipment = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
  const UniqueShipment = await req.prisma?.shipment_costs?.groupBy({
    by: ["shipment_no", "driver_code"],
    where: {
      drivers: {
        id: {
          in: id_drivers,
        },
      },
      shipments: {
        shipment_status: {
          not: STATUS_SHIPMENT.CANCELLED,
        },
        shipment_date: {
          gte: start,
          lte: end,
        },
      },
    },
    _count: true,
  });

  const UniqueDriverCode = Array.from(
    new Set(UniqueShipment?.map((d) => d.driver_code)).values(),
  );

  const total_shipment = UniqueDriverCode.map((driver_code) => {
    const count_shipment =
      UniqueShipment?.filter((d) => d.driver_code === driver_code)?.reduce(
        (current, item) => current + item._count,
        0,
      ) ?? 0;

    return {
      driver_code,
      count_shipment,
    };
  });

  return total_shipment;
};

const getTotalAttendanceSalary = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
  const driver_monthly_salary =
    (await req.prisma?.variable_configs
      .findFirst({
        where: {
          key: KEY_DRIVER_MONTHLY_ATTENDANCE_SALARY,
        },
        select: {
          value: true,
        },
      })
      .then((d) => d?.value ?? 0)) ?? 0;

  const total_attendance_salary: [string, number][] =
    (await req
      .prisma!.driver_attendances.groupBy({
        by: ["attendance_date", "driver_code"],
        where: {
          id: {
            in: id_drivers,
          },
          driver_code: {
            not: {
              equals: null,
            },
          },
          attendance_date: {
            gte: start,
            lte: end,
          },
          attendance_status: true,
        },
        _count: {
          id: true,
        },
      })
      .then((item) =>
        item.map(({ driver_code, _count }) => [
          driver_code!,
          _count.id * driver_monthly_salary ?? 0,
        ]),
      )) ?? [];

  return total_attendance_salary;
};

const getRangeDelivery = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
  const date = await req.prisma?.shipments.groupBy({
    by: ["shipment_date", "shipment_no"],
    where: {
      shipment_costs: {
        some: {
          drivers: {
            id: {
              in: id_drivers,
            },
          },
        },
      },
    },
    orderBy: {
      shipment_date: "asc",
    },
  });
};

/*
note for return  {
   total_row : 35,
   current : 1,
   page_size : 10
 }

its a redundant while it could compress in 'total'
why reason: 

The params pagination "page_size" and "current" is being set as optional, 
so if the value is null, the default value should be a fixed number (in BE). Decide whether to use 10 or 100; for this example, use 10. The total is 100, so the front end (FE) can easily calculate the 'current' value by dividing 100 by 10, which equals 10. If a value is provided, the FE should already have a divisor; just take the value from the FE and divide it by the total from the back end (BE). This way, the information can be compressed efficiently.

Of course, we don't aim for a perfect world, as there might be situations where there are many variables, like with old design patterns. To standardize, just follow the current approach because refactoring costs are higher. This approach is fine for delivery and hitting the target. However, if possible, we should aim to use something more efficient in the future.


*/
