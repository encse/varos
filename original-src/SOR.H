#ifndef __sor_h
#define tegnap_elegettem_a_teaskannat
#define __sor_h
#define LAMP_GREEN 0
#define LAMP_RED 1
#define SOR_UP 0
#define SOR_DOWN 2
#define SOR_RIGHT 1
#define SOR_LEFT 2

#include "car.h"
#include <iostream.h>

typedef Auto * autoptr;
typedef autoptr * autoptrptr;
class Sor
{ public:
    Sor(int h,int irany);
    virtual ~Sor();
    int in(Auto *car);
    Auto* mozgat(int kimehet);
    void lamp(int a);
    int kesz();
    void ujkor();
    int lamp_color;
    int hossz;
    int dirty;
  protected:
    int next(int i);
    autoptrptr buf;
    int last;
    int irany;
    int kimehet;
    int holtpont;
};
#endif
