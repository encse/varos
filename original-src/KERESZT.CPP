#include <conio.h>
#include <stdio.h>
#include <fstream.h>
#include "kereszt.h"
#include "sor.h"
#include "car.h"
#include "grx20.h"
Kereszt::Kereszt()
{ }
void Kereszt::Beallit(struct keresztezodes k)
{ for(int i=0; i<4; i++)
  { if(k.uthosszok[i])
    { utak[i] = new Sor(k.uthosszok[i],1);
      if(!utak[i])
      { printf("Nem sikeült lefoglalni a sort.");
	getch();
      }
      utak[i]->lamp(LAMP_RED);
    }
    else utak[i]=NULL;
    terulet[i] = NULL;
    szomszedok[i] = k.szomszedok[i];
  }
  where.y=k.where.y;
  where.x=k.where.x;
  periodusido=k.periodusido;
  melyikZold=k.melyikZold;
  utak[melyikZold]->lamp(LAMP_GREEN);
  tipus=k.tipus;
  ido=0;


}
Kereszt::~Kereszt()
{ for(int i=0;i<4;i++)
    if(utak[i]) utak[i]->~Sor();
}

Coord Kereszt::position()
{ return where;
}
void Kereszt::ujkor()
{ for(int i=0;i<4;i++)
  { if (utak[i]) utak[i]->ujkor();
    if(terulet[i]) terulet[i]->canmove=1;
  }
  clock_seged=0;
}
int Kereszt::clock()
{ int dirty2=0;
  if (tipus==KERESZT_SPEC) dirty2=suburb();
  else
  {
  int i;
  int dirty;
  //Először a kereszteződés területén belül mozgunk.
  do
  { dirty=0;
    for(i=0; i<4; i++)
    { if(terulet[i]&&terulet[i]->canmove)
      {
	//Ha helyben vagyunk, akkor megpróbálunk kilépni.
	if( i == kilep[i])
	{ int irany=terulet[i]->irany();
	  if( szomszedok[i]->utak[irany]->in(terulet[i]) ) terulet[i]=NULL,dirty=1,dirty2=1;
	}
	//Különben megyünk szépen tovább.
	else if ( !terulet[(i+3)%4] )
	{ int irany=terulet[i]->turn(2);
	  if ((i+1)%4==irany) terulet[i]->turn(1);
	  terulet[i]->go(1);
	  terulet[(i+3)%4]=terulet[i];
	  terulet[i]=NULL;
	  kilep [(i+3)%4]=kilep[i];
	  dirty=1,dirty2=1;
	}
      }
    }
  } while(dirty);

  //Ha váltani kell a lámpát.
  if(ido==periodusido)
  { ido=0;
    utak[melyikZold]->lamp(LAMP_RED);
    melyikZold=(melyikZold+1)%4;
    utak[melyikZold]->lamp(LAMP_GREEN);
  }
  kirajzol();

  //A piros lámpás sorokat mozgatjuk.
  for(i=0;i<4;i++)
  { if(i!=melyikZold)
    { utak[i]->mozgat(0);
      //Megnézzük, hogy volt-e valami mozgás a sorban
      if(utak[i]->dirty) dirty2=1;
    }
  }

  if (terulet[melyikZold])
  {  utak[melyikZold]->mozgat(0);
     if(utak[melyikZold]->dirty) dirty2=1;
  }
  //a zöldből esetleg be is léphet auto a kereszteződésbe.
  else
  { terulet[melyikZold]=utak[melyikZold]->mozgat(1);
    if(utak[melyikZold]->dirty) dirty2=1;
    //ha belépett autó (a szerencsétlen)
    if(terulet[melyikZold])
    { int kovkanyar=terulet[melyikZold]->nextturning();
      // kereszteződésben nem sietünk, időegységenként csak 1-et lehet lépni.
      terulet[melyikZold]->canmove=0;
      //ha már nem tud hova kanyarodni, akkor felejtsük el.
      if (!kovkanyar) terulet[melyikZold]->clear(),terulet[melyikZold]->allapot=-1,terulet[melyikZold]=NULL;
      else
      {
	//aztán nézzük meg, hogy hol fog kilépni az autó.
	switch(kovkanyar)
	{ case 1:
	    terulet[melyikZold]->turning++;
	    kilep[melyikZold]=(melyikZold+2)%4;
	  break;
	  case 2:
	    terulet[melyikZold]->turn();
	    kilep[melyikZold]=(melyikZold+3)%4;
	  break;
	  case 3:
	    terulet[melyikZold]->turn();
	    kilep[melyikZold]=melyikZold;
	}

      }

    }
  }

  if(!clock_seged) ido++;
  clock_seged=1;
  }
  return dirty2;
}
int Kereszt::suburb()
{ Auto *ptr;
  if (melyikZold!=-1)
  { ptr=utak[melyikZold]->mozgat(1);
    if(ptr)ptr->hatter=0;ptr->clear(),ptr->allapot=-1;
    switch (melyikZold)
    { case 1:
	for(int i=where.x-utak[1]->hossz-1;i<where.x-1;i++)
	  GrLine(i*EGYSEG+ELTOL_X,where.y*EGYSEG+ELTOL_Y,i*EGYSEG+EGYSEG/2+ELTOL_X,where.y*EGYSEG+ELTOL_Y,15);
	GrLine((where.x-utak[1]->hossz-1)*EGYSEG+ELTOL_X,where.y*EGYSEG+ELTOL_Y,(where.x-utak[1]->hossz-1)*EGYSEG+ELTOL_X,(where.y-1)*EGYSEG+1+ELTOL_Y,15);

      break;
      case 2:
	for(int i=where.y-utak[2]->hossz-1;i<where.y-1;i++)
	  GrLine(where.x*EGYSEG+ELTOL_X,i*EGYSEG+ELTOL_Y,where.x*EGYSEG+ELTOL_X,i*EGYSEG+EGYSEG/2+ELTOL_Y,15);
	GrLine(where.x*EGYSEG+ELTOL_X,(where.y-utak[2]->hossz-1)*EGYSEG+ELTOL_Y,(where.x+1)*EGYSEG-1+ELTOL_X,(where.y-utak[2]->hossz-1)*EGYSEG+ELTOL_Y,15);
      break;
    }
  }
  return utak[melyikZold]->dirty;
}
int Kereszt::Zold()
{ return melyikZold;
}
void Kereszt::kirajzol()
{   int szin;
    int m=EGYSEG/6;
    int r=EGYSEG/8;
    if (r<2) r=2, m=3;
    if(utak[2]->lamp_color==LAMP_RED) szin=9; else szin=11;
    GrFilledCircle((where.x-1)*EGYSEG-m+ELTOL_X,(where.y-1)*EGYSEG-m+ELTOL_Y,r,szin);
    for(int i=where.y-utak[2]->hossz-1;i<where.y-1;i++)
      GrLine(where.x*EGYSEG+ELTOL_X,i*EGYSEG+ELTOL_Y,where.x*EGYSEG+ELTOL_X,i*EGYSEG+EGYSEG/2+ELTOL_Y,15);
    GrLine(where.x*EGYSEG+ELTOL_X,(where.y-1)*EGYSEG-EGYSEG/6+ELTOL_Y,where.x*EGYSEG+ELTOL_X,(where.y-1)*EGYSEG-1+ELTOL_Y,15);
    GrLine(where.x*EGYSEG+ELTOL_X,(where.y-1)*EGYSEG+ELTOL_Y,(where.x-1)*EGYSEG+ELTOL_X+1,(where.y-1)*EGYSEG+ELTOL_Y,15);

    if (szomszedok[3]->tipus!=KERESZT_SPEC)
      GrLine(where.x*EGYSEG+ELTOL_X,(where.y-utak[2]->hossz-1)*EGYSEG+ELTOL_Y,(where.x+1)*EGYSEG+ELTOL_X-1,(where.y-1-utak[2]->hossz)*EGYSEG+ELTOL_Y,15);
  
    if(utak[3]->lamp_color==LAMP_RED) szin=9; else szin=11;
    GrFilledCircle((where.x+1)*EGYSEG+m+ELTOL_X,(where.y-1)*EGYSEG-m+ELTOL_Y,r,szin);

    if(utak[1]->lamp_color==LAMP_RED) szin=9; else szin=11;
    GrFilledCircle((where.x-1)*EGYSEG-m+ELTOL_X,(where.y+1)*EGYSEG+m+ELTOL_Y,r,szin);
    for(int i=where.x-utak[1]->hossz-1;i<where.x-1;i++)
      GrLine(i*EGYSEG+ELTOL_X,where.y*EGYSEG+ELTOL_Y,i*EGYSEG+EGYSEG/2+ELTOL_X,where.y*EGYSEG+ELTOL_Y,15);
    GrLine((where.x-1)*EGYSEG-EGYSEG/6+ELTOL_X,where.y*EGYSEG+ELTOL_Y,(where.x-1)*EGYSEG-1+ELTOL_X,where.y*EGYSEG+ELTOL_Y,15);
    GrLine((where.x-1)*EGYSEG+ELTOL_X,where.y*EGYSEG+ELTOL_Y,(where.x-1)*EGYSEG+ELTOL_X,(where.y+1)*EGYSEG+ELTOL_Y-1,15);
    if (szomszedok[2]->tipus!=KERESZT_SPEC)
    GrLine((where.x-utak[1]->hossz-1)*EGYSEG+ELTOL_X,where.y*EGYSEG+ELTOL_Y,(where.x-1-utak[1]->hossz)*EGYSEG+ELTOL_X,(where.y-1)*EGYSEG+ELTOL_Y+1,15);
  

    if(utak[0]->lamp_color==LAMP_RED) szin=9; else szin=11;
    GrFilledCircle((where.x+1)*EGYSEG+m+ELTOL_X,(where.y+1)*EGYSEG+m+ELTOL_Y,r,szin);
}



