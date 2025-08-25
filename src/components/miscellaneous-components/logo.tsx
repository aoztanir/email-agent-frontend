import { cn } from "@/lib/utils";

export default function Logo({
  className = "",
  size = 30,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn("text-primary w-fit h-fit" + className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size + "px"}
        height={size + "px"}
        fill="currentColor"
        viewBox="0 0 256 256"
      >
        <path d="M120,56v48a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40h48A16,16,0,0,1,120,56Zm80-16H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm-96,96H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm96,0H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Z"></path>
      </svg>
    </div>
  );
}
