#include <conio.h>
#include <iostream.h>
#include <fstream.h>
#include "coord.h"
#include "car.h"
#include "grx20.h"
int meretok(int x,int y)
{ if(x>=0 && x<GrScreenX() && y>=0 && y<GrScreenY()) return 1;
  return 0;
}
int FilledBox(int x1, int y1, int x2, int y2, int color)
{ if( meretok(x1,y1)&&meretok(x2,y2))
  { GrFilledBox(x1,y1,x2,y2,color);
    return 1;
  }
  return 0;
}
int Auto::go(int i)
{ if ( i > speed ) i = speed;
  if (canmove)
  { canmove--;
    clear();
    hatter=12;
    switch(direction)
    { case 0:
	where.y-=i;
	break;
      case 1:
        where.x+=i;
	break;
      case 2:
	where.y+=i;
	break;
      case 3:
	where.x-=i;
    }
    write();
    return i;
  }
  return 0;
}
int Auto::can_go()
{ return canmove;
}
int Auto::you_can_go()
{ canmove=speed;
  return speed;
}
int Auto::nextturning()
{ return route[turning];
}
int Auto::turn()
{ clear();
  switch(route[turning++])
  { case 0:
      return 0;
      break;
    case 1:
	direction=(direction+3)%4;
      break;
    case 3:
	direction=(direction+1)%4;
  }
  write();
  return 1;
}
int Auto::turn(int a)
{ clear();
  switch(a)
  { case 1:
	direction=(direction+3)%4;
      break;
    case 3:
	direction=(direction+1)%4;
  }
  write();
  return direction;
}
int Auto::irany()
{ return direction;
}
Coord Auto::position()
{ return where;
}
int Auto::read(ifstream &data)
{ int i=0;
  data >> speed;
  if (speed)
  { data >> where.x;
    data >> where.y;
    data >> direction;
    data >> color;
    data >> route[0];
    while (route[i]) data >> route[++i];
    hossz=i;
    canmove=speed;
    allapot=0;
    return 1;
  }
  return 0;
}
void Auto::write()
{ if(allapot!=-1)
  { int m1,m2,s;
    int k;
    if (direction==1 || direction==3) m1=EGYSEG/8, m2=EGYSEG/4;
    else m1=EGYSEG/4, m2=EGYSEG/8;
    if(EGYSEG < 5) m1=m2=0;
    int x1=(int)(ELTOL_X+(where.x-1)*EGYSEG+m1); //where 1-el beljebb ill. lejjebb van mint kene.
    int x2=(int)(ELTOL_X+(where.x)*EGYSEG-m1);
    int y1=(int)(ELTOL_Y+(where.y-1)*EGYSEG+m2);
    int y2=(int)(ELTOL_Y+(where.y)*EGYSEG-m2);
    if(x1==x2 || y1==y2) x2++, y2++;
    s=1;
    int s2=EGYSEG/4;
    k=FilledBox(x1,y1,x2,y2,color);
    if(k&& EGYSEG >=8)
    { switch(direction)
      { case 0:
	  if (index==1) FilledBox(x1,y1+1,x1+s,y1+s+1,13);
	  else if (index==3) FilledBox(x2-s,y1+1,x2,y1+s+1,13);
	  FilledBox(x1+1,y2-s+1,x1+s+1,y2,10);
	  FilledBox(x2-s-1,y2-s+1,x2-1,y2,10);
          GrBox(x1+s,y1+s2,x2-s,y2-s-1,12);
	break;
	case 1:
	  if (index==1) FilledBox(x2-s-1,y1,x2-1,y1+s,13);
	  else if (index==3) FilledBox(x2-s-1,y2-s,x2-1,y2,13);
	  FilledBox(x1,y1+1,x1+s-1,y1+s+1,10);
	  FilledBox(x1,y2-s-1,x1+s-1,y2-1,10);
          GrBox(x1+s+1,y1+s,x2-s2-2,y2-s,12);
	break;
	case 2:
	  if (index==1) FilledBox(x2-s,y2-s-1,x2,y2-1,13);
	  else if (index==3) FilledBox(x1,y2-s-1,x1+s,y2-1,13);
	  FilledBox(x1+1,y1,x1+s+1,y1+s-1,10);
	  FilledBox(x2-s-1,y1,x2-1,y1+s-1,10);
	  GrBox(x1+s,y1+s+1,x2-s,y2-s2-1,12);
//          GrLine(x1+s,y1+s2,x2-s,y1+s2,14);
	break;
	case 3:
	  if (index==1) FilledBox(x1+1,y2-s,x1+s+1,y2,13);
	  else if (index==3) FilledBox(x1+1,y1,x1+s+1,y1+s,13);
	  FilledBox(x2-s+1,y1+1,x2,y1+s+1,10);
	  FilledBox(x2-s+1,y2-s-1,x2,y2-1,10);
	  GrBox(x1+s2+1,y1+s,x2-s-1,y2-s,12);
//          GrLine(x1+s,y1+s2,x2-s,y1+s2,14);
      }
    }
  }
}
void Auto::init(int a, int b, int c)
{ EGYSEG=a;
  ELTOL_X=b;
  ELTOL_Y=c;
}
void Auto::clear()
{ int m1,m2;
  if (direction==1 || direction==3) m1=EGYSEG/8, m2=EGYSEG/4;
  else m1=EGYSEG/4, m2=EGYSEG/8;
  if(EGYSEG < 5) m1=m2=0;
  int x1=(int)(ELTOL_X+(where.x-1)*EGYSEG+m1); //where 1-el beljebb ill. lejjebb van mint kene.
  int x2=(int)(ELTOL_X+(where.x)*EGYSEG-m1);
  int y1=(int)(ELTOL_Y+(where.y-1)*EGYSEG+m2);
  int y2=(int)(ELTOL_Y+(where.y)*EGYSEG-m2);
  if(x1==x2 || y1==y2) x2++, y2++;
  FilledBox(x1,y1,x2,y2,hatter);
}

