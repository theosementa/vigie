
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { Icon } from "@/components/Icon"

const Toaster = ({ ...props }: ToasterProps) => {
  

  return (
    <Sonner
      theme="system"
      className="toaster group"
      closeButton
      offset={{ bottom: "var(--toast-bottom)" }}
      mobileOffset={{ bottom: "var(--toast-bottom)" }}
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
          // The DA toast is inverted: text colour as background (base.css, "Toasts")
          "--normal-bg": "var(--text)",
          "--normal-text": "var(--bg)",
          "--normal-border": "transparent",
          "--border-radius": "12px",
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
