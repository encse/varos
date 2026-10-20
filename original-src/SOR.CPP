#include <conio.h>
#include <iostream.h>
#include "sor.h"
Sor::Sor(int h, int a)
{ if(h>0)
  { buf= new autoptr[h];
    for(int i=0;i<h;i++)
    { buf[i]=0;
    }
    hossz=h;
    lamp_color=LAMP_GREEN;
    last=-1;
    irany=a;
    kimehet=1;
    holtpont=1;
  }
}
Sor::~Sor()
{ delete []buf;
}
int Sor::in(Auto *car)
{ if(!buf[hossz-1])
  { last=hossz-1;
    buf[last]=car;
    car->index=car->nextturning();
    if (car->index==2) car->index=0;
    car->go(1);
    return 1;
  }
  return 0;
}
void Sor::lamp(int a)
{ if (a==LAMP_GREEN||a==LAMP_RED) lamp_color=a;
}
int Sor::kesz()
{ return 1-holtpont;
}
void Sor::ujkor()
{ for(int i=0;i<hossz;i++)
  { if (buf[i])
    { buf[i]->you_can_go();
    }
  }
  holtpont=1;
}
int Sor::next(int s)
{ for(int k=s;k<hossz;k++)
  { if (buf[k]) return k;
  }
  return -1;
}
Auto* Sor::mozgat(int k)
{ int i,hol;
  kimehet=k;
  Auto *belepoAuto=NULL;
  dirty=0;
  do
  { i=hol=holtpont=0;
    while (hol >= 0)
    { hol=next(i);
      if ( hol >= 0 )
      { // Ha az auto meg mehet elore
	if (buf[hol] -> can_go())
	{
	  // es bemegyunk a keresztezodesbe
	  if (!hol)
	  { if ( kimehet && !lamp_color )
	    { i = 0;
	      buf[hol]->go(1);
	      belepoAuto=buf[hol];
	      buf[hol] = NULL;
	      holtpont=dirty=1;
	      kimehet=0;
	    }
	    else
	    { // illetve ha nem tudunk elobbre menni, mert nem mehetunk be
	      // a keresztezodesbe
	      i++;
	    }
	  }
	  else
	  { // vagy elobbre megyunk a sorban
	    if(hol>i)
	    { i = hol;
	      buf[i-1] = buf[hol];
	      buf[hol]->go(1);
	      buf[hol] = NULL;
	      holtpont=dirty=1;
	    }
	    else i++;
	  }
	}
	else i++;
      }
    }
  }while(holtpont);
  for (i=0;i<hossz;i++) if (buf[i]) last=i;
  return belepoAuto;
}
