#ifndef __kereszt_h
#define __kereszt_h
#include "coord.h"
#include "car.h"
#include "sor.h"
#define KERESZT_NORM 1
#define KERESZT_SPEC 2

class Kereszt;

typedef struct keresztezodes{
  Coord where;
  int uthosszok[4];
  Kereszt *szomszedok[4];
  int periodusido;
  int melyikZold;
  int tipus;
};

class Kereszt
{ public:
    typedef keresztezodes *keresztezodesptr;
    Kereszt();
    virtual ~Kereszt();
    void Beallit(struct keresztezodes k);
    Coord position(void);
    void ujkor();
    int clock(void);
    int suburb(void);
    int Zold();
    Sor *utak[4];
    Coord where;
    int EGYSEG,ELTOL_X,ELTOL_Y;
    Kereszt *szomszedok[4];
    int tipus;
    void kirajzol();
  protected:
    Auto *terulet[4];
    int kilep[4];
    int periodusido;
    int melyikZold;
    int ido;
    int clock_seged;
};
#endif
