
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Icon } from "@/components/Icon"

const Toaster = ({ ...props }: ToasterProps) => {
  

  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: (
          <Icon name="check-circle" className="size-4" />
        ),
        info: (
          <Icon name="info-circle" className="size-4" />
        ),
        warning: (
          <Icon name="danger-triangle" className="size-4" />
        ),
        error: (
          <Icon name="close-circle" className="size-4" />
        ),
        loading: (
          <Icon name="loader" className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
