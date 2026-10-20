#ifndef __car_h
#define __car_h
#include <fstream.h>
#include "coord.h"
#define AUTO_VAR 1
#define AUTO_MEGY 0
#define AUTO_MEGHAL -1
class Auto
{ public:
    Auto(){turning=0;index=0;hatter=0;}
    virtual ~Auto(){;}
    void init(int EGYSEG, int ELTOL_X, int ELTOL_Y);
    int go(int);
    int nextturning();
    int turn();
    int turn(int direction);
    int irany(void);
    void write();
    void clear();
    Coord position();
    int read(ifstream &);
    int can_go();
    int you_can_go();
    int speed;
    int canmove;
    int allapot;
    int color;
    int turning;
    int index;
    int hatter;

  protected:
    Coord where;
    int direction;
    int route[100];
    int hossz;
    int EGYSEG, ELTOL_X, ELTOL_Y;
};
#endif

