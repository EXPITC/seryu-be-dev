import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Z_SalaryDriverList } from "@zodSchema/salary/zDriverSchema";
import dayjs from "dayjs";
import { Request, Response } from "express";
import { defaultErrorHandling } from "utils/defaultErrHandling";
import { isSearch } from "utils/isSearch";

const STATUS_COST = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PAID: "PAID",
};

const STATUS_SHIPMENT = {
  CANCELLED: "CANCELLED",
  RUNNING: "RUNNING",
  DONE: "DONE",
};

const KEY_DRIVER_MONTHLY_ATTENDANCE_SALARY = "DRIVER_MONTHLY_ATTENDANCE_SALARY";

// Helper Function to calculate total shipment cost for drivers
const getTotalShipmentCost = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
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
  ];

  return Promise.all(
    id_drivers.map(async (id) => {
      const costPending =
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
          .then((d) => d?._sum?.total_costs ?? defaultDecimal)) ??
        defaultDecimal;

      const costConfirm =
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
          .then((d) => d?._sum?.total_costs ?? defaultDecimal)) ??
        defaultDecimal;

      const costPaid =
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
          .then((d) => d?._sum?.total_costs ?? defaultDecimal)) ??
        defaultDecimal;

      return {
        id_drivers: id,
        cost_pending: costPending,
        cost_confirm: costConfirm,
        cost_paid: costPaid,
        cost_total: costPending.plus(costConfirm).plus(costPaid),
      };
    }),
  );
};

// Helper function to get total shipment for drivers
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

  return UniqueDriverCode.map((driver_code) => {
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
};

// Helper function to get total attendance salary for drivers
const getTotalAttendanceSalary = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
  const driverMonthlySalary =
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

  return ((await req
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
        _count.id * driverMonthlySalary ?? 0,
      ]),
    )) ?? []) as [string, number][];
};

// Helper function to get exact range deliver date delivery
const getExactRangeDeliverDateDelivery = async (
  req: Request,
  id_drivers: number[],
  start: string,
  end: string,
) => {
  const exactRangeDeliverDateDelivery = await Promise.all(
    id_drivers.map(async (id) => {
      const date = await req.prisma?.shipments.groupBy({
        by: ["shipment_date", "shipment_no"],
        where: {
          shipment_costs: {
            some: {
              drivers: { id },
            },
          },
          shipment_date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: {
          shipment_date: "asc",
        },
      });

      return {
        id_driver: id,
        firstDelivery: date?.[0],
        lastDelivery: date?.[date.length - 1],
      };
    }),
  );

  return exactRangeDeliverDateDelivery;
};

export const HandleGetSalaryDriverList = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = Z_SalaryDriverList.parse(req.body);

    const search = isSearch(input.search);
    const start = dayjs(input.date).startOf("month").toISOString();
    const end = dayjs(input.date_to || input.date)
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
      AND: [
        input.filters?.status
          ? filters_shipment_cost[input.filters.status]
          : {},
        input.filters?.driver_code
          ? { driver_code: input.filters.driver_code }
          : {},
        {
          OR: search.isValid
            ? [
                { driver_code: { contains: search.text } },
                { name: { contains: search.text } },
                search.isNumber
                  ? { shipment_costs: { some: { total_costs: search.number } } }
                  : {},
              ]
            : [],
        },
      ],
    };

    const total = (await req.prisma?.drivers.count({ where })) ?? 0;

    const dataRaw =
      (await req.prisma?.drivers.findMany({
        where,
        take: input.pagination.take,
        skip: input.pagination.skip,
      })) ?? [];

    const id_drivers = dataRaw.map((d) => d.id);
    const totalShipmentCost = await getTotalShipmentCost(
      req,
      id_drivers,
      start,
      end,
    );
    const totalShipment = await getTotalShipment(req, id_drivers, start, end);
    const totalAttendanceSalary = await getTotalAttendanceSalary(
      req,
      id_drivers,
      start,
      end,
    );
    const exactDeliveryDate = await getExactRangeDeliverDateDelivery(
      req,
      id_drivers,
      start,
      end,
    );

    const total_attendance_salary = new Map(totalAttendanceSalary);

    const data = dataRaw
      .map(({ id, driver_code, name }) => {
        const shipmentCost = totalShipmentCost.find(
          (cost) => cost.id_drivers === id,
        ) ?? {
          cost_pending: new Decimal(0),
          cost_confirm: new Decimal(0),
          cost_paid: new Decimal(0),
          cost_total: new Decimal(0),
        };

        const total_shipmentCost = shipmentCost.cost_total;

        const totalSalary = total_shipmentCost.plus(
          new Decimal(total_attendance_salary.get(driver_code) ?? 0),
        );

        if (totalSalary.gt(0)) {
          return {
            driver_code,
            name,
            total_pending: shipmentCost.cost_pending,
            total_confirmed: shipmentCost.cost_confirm,
            total_paid: shipmentCost.cost_paid,
            total_attendance_salary:
              total_attendance_salary.get(driver_code) ?? 0,
            total_salary: totalSalary,
            count_shipment:
              totalShipment.find((ts) => ts.driver_code === driver_code)
                ?.count_shipment ?? 0,
            firstDelivery:
              exactDeliveryDate.find((ed) => ed.id_driver === id)
                ?.firstDelivery ?? null,
            lastDelivery:
              exactDeliveryDate.find((ed) => ed.id_driver === id)
                ?.lastDelivery ?? null,
          };
        }
      })
      .filter(Boolean); // Remove undefined entries.

    const response = {
      optional: {
        total_row: total,
        total_page: Math.ceil(total / input.pagination.take),
        current: input.pagination.skip + 1,
        page_size: input.pagination.take,
      },
      data,
    };

    return res.json(response);
  } catch (err) {
    return defaultErrorHandling(req, res, err);
  }
};
