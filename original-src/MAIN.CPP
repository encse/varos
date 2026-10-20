#include <conio.h>
#include <stdio.h>
#include <iostream.h>
#include <fstream.h>
#include <dos.h>
#include "coord.h"
#include "car.h"
#include "sor.h"
#include "kereszt.h"
#include "varos.h"

int main(int argc, char *argv[])
{ char a=0;
  if (argc<2)
  { printf("Hibás paraméterezés.\n\rA futtatáshoz meg kell adni az autók adatait tartalmazó fájlt is. (varos.txt)\n\r");
    return 1;
  }
  printf("A várost elhagyni a 'q' billentyűvel lehet.");
  getch();
  varos v(argv[1]);
  while(a!='q')
  { v.go();
//    if(kbhit())
    a=getch();
  }
  return 0;
}

