"use client"

import { useTheme } from "@/lib/theme"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, XIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = "light" } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-500" />,
        info: <InfoIcon className="size-4 text-sky-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-rose-500" />,
        loading: <Spinner size="sm" label="Loading" />,
        close: <XIcon className="size-3" />,
      }}
      closeButton
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
          // Sonner's default fixed 356px toast width doesn't grow for
          // longer content (e.g. an update-check error message appended
          // to a toast description) and doesn't shrink below its own
          // width on narrow viewports either - clamp it to the viewport
          // instead of a hardcoded px value so it never overflows.
          "--width": "min(356px, calc(100vw - 2rem))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Sonner's own [data-sonner-toast] root is `display:flex;
          // align-items:center` with no wrap, so the icon, the
          // title+description column, and any action/cancel buttons are
          // all forced onto one row - fine for short text, but a longer
          // description (e.g. an update-check error message) plus a
          // button either overflows the toast or gets clipped. Wrapping
          // to a second line, and letting the box grow to content height,
          // fixes both without touching sonner's own CSS file.
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl p-4 font-sans border group-[.toaster]:max-w-[calc(100vw-2rem)] group-[.toaster]:flex-wrap group-[.toaster]:!h-auto",
          title: "group-[.toast]:font-semibold group-[.toast]:text-foreground text-sm",
          description:
            "group-[.toast]:text-muted-foreground text-xs mt-0.5 [overflow-wrap:anywhere]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:rounded-md hover:group-[.toast]:opacity-90 transition-opacity group-[.toast]:whitespace-nowrap group-[.toast]:!ml-0",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:font-medium group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:rounded-md group-[.toast]:whitespace-nowrap",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
