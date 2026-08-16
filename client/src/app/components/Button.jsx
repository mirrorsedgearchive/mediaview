const Button = ({ variant = 'primary', className = '', children, ...props }) => (
  <button
    type="button"
    className={`app-button app-button-${variant}${className ? ` ${className}` : ''}`}
    data-modal-primary={variant === 'primary' ? true : undefined}
    {...props}
  >
    {children}
  </button>
);

export default Button;
