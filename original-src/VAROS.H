#ifndef varos_h
#define varos_h
#include <fstream.h>
#include "car.h"
class varos
{ public:
    varos(char *nev);
    virtual ~varos();
    void go(void);
    void kirajzol(void);
    int hiba;
  protected:
    void beolvas();
    int betesz(Auto &car);

    char varosfilename[20];
    char autofilename[20];
    ifstream varosfile,autofile;
    int fuggUtcak, vizszUtcak;
    int *vizszUtcaHossz;
    int *fuggUtcaHossz;
    Kereszt *keresztezodesek;
    keresztezodes init;
    int autokszama;
    autoptr carptr;
    int last;
    int var;
    int EGYSEG;
    int ELTOL_X,ELTOL_Y;

};
#endif