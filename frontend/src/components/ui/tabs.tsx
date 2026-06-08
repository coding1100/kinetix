"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center text-muted-foreground group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default:
          "justify-center rounded-lg bg-muted p-[3px] group-data-horizontal/tabs:h-8",
        line: "h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap transition-colors outline-none",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:flex-1",
        "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent",
        "group-data-[variant=default]/tabs-list:px-2 group-data-[variant=default]/tabs-list:py-0.5 group-data-[variant=default]/tabs-list:text-sm group-data-[variant=default]/tabs-list:font-medium",
        "group-data-[variant=default]/tabs-list:text-foreground/60 group-data-[variant=default]/tabs-list:hover:text-foreground",
        "group-data-[variant=default]/tabs-list:data-active:bg-background group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm",
        "group-data-[variant=default]/tabs-list:dark:data-active:border-input group-data-[variant=default]/tabs-list:dark:data-active:bg-input/30",
        "group-data-[variant=default]/tabs-list:focus-visible:ring-2 group-data-[variant=default]/tabs-list:focus-visible:ring-ring/40",
        "group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:flex-none",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-0 group-data-[variant=line]/tabs-list:bg-transparent",
        "group-data-[variant=line]/tabs-list:px-3 group-data-[variant=line]/tabs-list:py-2.5 group-data-[variant=line]/tabs-list:text-sm",
        "group-data-[variant=line]/tabs-list:font-medium group-data-[variant=line]/tabs-list:text-muted-foreground",
        "group-data-[variant=line]/tabs-list:hover:text-foreground",
        "group-data-[variant=line]/tabs-list:data-active:font-semibold group-data-[variant=line]/tabs-list:data-active:text-foreground",
        "group-data-[variant=line]/tabs-list:focus-visible:ring-0",
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:right-0",
        "group-data-[variant=line]/tabs-list:after:bottom-0 group-data-[variant=line]/tabs-list:after:left-0",
        "group-data-[variant=line]/tabs-list:after:h-0.5 group-data-[variant=line]/tabs-list:after:rounded-full",
        "group-data-[variant=line]/tabs-list:after:bg-primary group-data-[variant=line]/tabs-list:after:opacity-0",
        "group-data-[variant=line]/tabs-list:after:transition-opacity",
        "group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
